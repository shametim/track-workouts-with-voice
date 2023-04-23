import fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { fetch, HeadersInit } from "undici";
import replyFrom from "@fastify/reply-from";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import * as ort from "onnxruntime-node";
import path from "node:path";
import multipart from "@fastify/multipart";

async function detectVoice(audioFrame: Float32Array) {
  const vadModel = await fs.readFile("assets/silero_vad.onnx");
  const bytes = vadModel.buffer;

  const audioTensor = new ort.Tensor("float32", audioFrame, [
    1,
    audioFrame.length,
  ]);
  const zeroes = Array(2 * 64).fill(0);

  const inputs = {
    input: audioTensor,
    h: new ort.Tensor("float32", zeroes, [2, 1, 64]),
    c: new ort.Tensor("float32", zeroes, [2, 1, 64]),
    sr: new ort.Tensor("int64", [16000]),
  };

  const inference = await ort.InferenceSession.create(bytes);
  const prediction = inference.run(inputs);

  return prediction;
}

const server: FastifyInstance = fastify({
  logger: false,
});

// server.addContentTypeParser("multipart/form-data", (req, body, done) => {
//   done(null, body);
// });

server.register(replyFrom);

server.register(multipart);

server.post("/proxy", async (request, reply) => {
  await reply.from("https://api.openai.com/v1/audio/transcriptions", {
    rewriteRequestHeaders: (request, headers) => {
      headers.authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
      return headers;
    },
  });
});

server.post(
  "/transcribe",
  async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const headers: HeadersInit = {};
      headers["authorization"] = `Bearer ${process.env.OPENAI_API_KEY}`;
      headers["content-type"] = request.headers["content-type"]!;
      request.raw.on("data", (chunk) => {
        console.log(chunk);
      });
      const transcription = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers,
          body: request.body as Buffer,
          duplex: "half",
        }
      );
      const response = (await transcription.json()) as any;
      reply.send(response);
    } catch (error: any) {
      console.log(error);
    }
  }
);

server.post("/upload", async (request: FastifyRequest, reply: FastifyReply) => {
  const data = await request.file();
  if (!data) {
    throw new Error("cant find data");
  }
  // data.file.
  const fileContent = await data.toBuffer();
  const fileName = `recording-${Date.now()}.bin`;
  const filePath = path.join(__dirname, fileName);

  try {
    await fs.writeFile(filePath, fileContent, { encoding: "base64" });
    reply.code(200).send({ message: "File uploaded successfully", fileName });
  } catch (error) {
    server.log.error(error);
    reply.code(500).send({ message: "Failed to upload file", error });
  }
});

server.post(
  "/upload-binary-body",
  async (request: FastifyRequest, reply: FastifyReply) => {
    const data = request.body;
    const fileName = `recording-${Date.now()}.bin`;
    const filePath = path.join(__dirname, fileName);

    try {
      await fs.writeFile(filePath, data, { encoding: "base64" });
      reply.code(200).send({ message: "File uploaded successfully", fileName });
    } catch (error) {
      server.log.error(error);
      reply.code(500).send({ message: "Failed to upload file", error });
    }
  }
);

server.listen({ port: 5000 }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  server.log.info(`Server listening at ${address}`);
});
