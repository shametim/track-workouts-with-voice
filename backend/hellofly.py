from flask import Flask, request
from pydub import silence
import openai
import os
import azure.cognitiveservices.speech as speechsdk

app = Flask(__name__)

subscription_key = os.environ.get('SPEECH_KEY')
region = os.environ.get('SPEECH_REGION')
# Create a SpeechConfig instance with your subscription key and region
speech_config = speechsdk.SpeechConfig(
    subscription=subscription_key, region=region)

# Create a SpeechSynthesizer instance with the speech_config
speech_synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config)

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
    # print('nonsilent', silence.detect_nonsilent(audio_file))
    # print('speech', silence.split_on_silence(audio_file))
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

    text = transcript.text
    result = speech_synthesizer.speak_text_async(text).get()

    # Check if the synthesis was successful
    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        print("Text-to-Speech synthesis was successful.")
    else:
        print(f"Text-to-Speech synthesis failed: {result.error_details}")

        # Save the audio to a file
    with open("assets/output.wav", "wb") as audio_file:
        audio_file.write(result.audio_data)
        print("Audio file saved as output.wav")

    return completion.choices[0].message.content
