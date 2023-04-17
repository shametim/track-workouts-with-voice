export async function streamAudio() {
  function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  const stream = new ReadableStream({
    async start(controller) {
      await wait(1000);
      controller.enqueue("This ");
      await wait(1000);
      controller.enqueue("is ");
      await wait(1000);
      controller.enqueue("a ");
      await wait(1000);
      controller.enqueue("slow ");
      await wait(1000);
      controller.enqueue("request.");
      controller.close();
    },
  }).pipeThrough(new TextEncoderStream());

  await fetch("https://localhost:5000/transcribe", {
    method: "POST",
    body: stream,
    duplex: "half",
  });
}
