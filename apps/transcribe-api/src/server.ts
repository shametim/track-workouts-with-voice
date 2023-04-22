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
import cors from "@fastify/cors";
import path from "node:path";

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
  logger: true,
  // http2: true,
  // https: {
  //   key: fsSync.readFileSync(path.join(__dirname, "..", "localhost+1-key.pem")),
  //   cert: fsSync.readFileSync(path.join(__dirname, "..", "localhost+1.pem")),
  // },
});

// server.register(cors, (instance: any) => {
//   return (req: any, callback: any) => {
//     const corsOptions = {
//       // This is NOT recommended for production as it enables reflection exploits
//       origin: "http://localhost:19000",
//     };

//     // callback expects two parameters: error and options
//     callback(null, corsOptions);
//   };
// });

server.addContentTypeParser("multipart/form-data", (req, body, done) => {
  done(null, body);
});
server.register(replyFrom);

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

server.listen({ port: 5000 }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  server.log.info(`Server listening at ${address}`);
});
