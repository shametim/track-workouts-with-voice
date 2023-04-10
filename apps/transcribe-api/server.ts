import fastify, { FastifyInstance } from "fastify";
import { Configuration, OpenAIApi } from "openai";
import multipart from "@fastify/multipart";
import fs from "node:fs";
import { pipeline } from "node:stream";
import util from "node:util";
import { request } from "undici";
import FormData from "form-data";

const pump = util.promisify(pipeline);

const app: FastifyInstance = fastify({ logger: true });

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })
);

app.register(multipart);

app.post("/transcribe", async (req, response) => {
  try {
    const recording = await req.file();
    if (!recording) {
      return;
    }

    await pump(recording.file, fs.createWriteStream(recording.filename));

    const transcription = await openai.createTranscription(
      fs.createReadStream(recording.filename),
      "whisper-1"
    );

    fs.unlink(recording.filename, (err) => {
      if (err) throw err;
    });

    response.send(transcription.data);
  } catch (error: any) {
    if (error.response) {
      console.log(error.response.status);
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
});

app.listen({ port: 5000 }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`Server listening at ${address}`);
});
