from flask import Flask, request
from pydub import silence
import openai
import os

app = Flask(__name__)


# speech synthesis
# import azure.cognitiveservices.speech as speechsdk
# subscription_key = os.environ.get('SPEECH_KEY')
# region = os.environ.get('SPEECH_REGION')
# speech_config = speechsdk.SpeechConfig(
#     subscription=subscription_key, region=region)
# speech_synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config)
# result = speech_synthesizer.speak_text_async("Got it!").get()

# # Check if the synthesis was successful
# if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
#     print("Text-to-Speech synthesis was successful.")
# else:
#     print(f"Text-to-Speech synthesis failed: {result.error_details}")


# pinecone.init(
#     api_key=os.environ.get('PINECONE_API_KEY'),  # find at app.pinecone.io
#     environment="us-east1-gcp"  # next to api key in console
# )
# index_name = "eexercises"


@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'recording.m4a' in request.files:
        audio_file = request.files['recording.m4a']
    elif 'recording.webm' in request.files:
        audio_file = request.files['recording.webm']
    else:
        print("File not found in request.")
        audio_file = None

    # silence optimization
    print('nonsilent', silence.detect_nonsilent(audio_file))
    print('speech', silence.split_on_silence(audio_file))
    transcript = openai.Audio.transcribe("whisper-1", file=audio_file)

    # this needs a lot of tweaking and testing and evaluating
    # this is basically the core of the product

    structure = '''{
                "exercises": [
                    {
                        "name": "Bench press",
                        "sets": [
                            {
                                "weight": 60,
                                "unit": "lbs",
                                "reps": 12
                            },
                        ]
                    },
                    {
                        "name": "Tricep extension",
                        "sets": [
                            {
                                "weight": 50,
                                "unit": "lbs",
                                "reps": 10
                            },
                        ]
                    }
                ]
            }'''
    completion = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": "format the following workout to json. example: " +
                structure + "workout: " + transcript.text}
        ]
    )

    return completion.choices[0].message.content
