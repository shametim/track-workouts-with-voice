from flask import Flask, request
from pydub import silence
import openai

app = Flask(__name__)


@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'recording.m4a' in request.files:
        audio_file = request.files['recording.m4a']
    elif 'recording.webm' in request.files:
        audio_file = request.files['recording.webm']
    else:
        print("File not found in request.")
        audio_file = None

    # print('nonsilent', silence.detect_nonsilent(audio_file))

    # print('speech', silence.split_on_silence(audio_file))

    transcript = openai.Audio.transcribe("whisper-1", file=audio_file)

    return transcript
