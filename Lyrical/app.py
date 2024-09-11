from flask import Flask, request, jsonify, send_file
import subprocess
from magenta.models.melody_rnn import melody_rnn_sequence_generator
from magenta.models.shared import sequence_generator_bundle
from note_seq.protobuf import generator_pb2, music_pb2
import note_seq
import os
from flask_cors import CORS
import concurrent.futures

app = Flask(__name__)
# Allow only requests from http://3.104.224.196:3000 with GET and POST methods
CORS(app, resources={r"/*": {"origins": "http://3.104.224.196:3000", "methods": ["GET", "POST"]}})


def generate_melody_rnn_midi(output_midi_path, notes, tempo=120, length=60, num_variations=5):
    # Load the pre-trained MelodyRNN model bundle
    bundle = sequence_generator_bundle.read_bundle_file('/app/Lyrical/attention_rnn.mag')
    generator_map = melody_rnn_sequence_generator.get_generator_map()
    melody_rnn = generator_map['attention_rnn'](checkpoint=None, bundle=bundle)

    # Create a MelodyRNN melody sequence from the provided notes
    melody = music_pb2.NoteSequence()
    melody.tempos.add(qpm=tempo)
    
    for note in notes:
        melody.notes.add(
            pitch=int(note['pitch']),  # Ensure pitch is an integer
            start_time=note['start_time'],
            end_time=note['end_time'],
            velocity=80
        )

    variations = []

    def generate_variation(variation_index):
        generator_options = generator_pb2.GeneratorOptions()
        generator_options.args['temperature'].float_value = 0.9  # Lower temperature for more variation

        # Adjust the generation section to be relative to the original sequence length, avoiding large gaps
        last_end_time = notes[-1]['end_time'] if notes else 4.0

        generator_options.generate_sections.add(
            start_time=last_end_time,  # Start immediately after the original sequence
            end_time=last_end_time + length  # Generate sequence with the specified length
        )

        # Generate the sequence
        sequence = melody_rnn.generate(melody, generator_options)

        # Save each generated variation as a MIDI file
        variation_output_path = f"{output_midi_path[:-4]}_variation_{variation_index}.mid"
        note_seq.midi_io.sequence_proto_to_midi_file(sequence, variation_output_path)
        
        variations.append({
            'variation': variation_index,
            'notes': [{"pitch": n.pitch, "start_time": n.start_time, "end_time": n.end_time} for n in sequence.notes]
        })

    # Use ThreadPoolExecutor to parallelize the generation of variations
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = [executor.submit(generate_variation, i) for i in range(num_variations)]
        concurrent.futures.wait(futures)

    return variations

@app.route('/generate_melody', methods=['POST'])
def generate_melody():
    data = request.json
    notes = data.get('notes', [])
    tempo = data.get('tempo', 120)
    length = data.get('length', 60)
    num_variations = data.get('variations', 5)

    output_midi_path = '/tmp/output.mid'
    variations = generate_melody_rnn_midi(output_midi_path, notes, tempo, length, num_variations)

    variation_files = []
    for i in range(num_variations):
        variation_file = f"{output_midi_path[:-4]}_variation_{i}.mid"
        if os.path.exists(variation_file):  # Check if file exists
            variation_files.append(variation_file)
        else:
            print(f"File not found: {variation_file}")  # Log if file not found

    print(f"Generated files: {variation_files}")  # Log the list of files

    return jsonify({
        "message": "Melody generated",
        "variations": variations,
        "variation_files": variation_files,
        "output_midi_path": output_midi_path
    })

def convert_midi_to_wav(midi_file, wav_file):
    # Path to the SoundFont file
    soundfont_path = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
    
    # Path to the FluidSynth binary
    fluidsynth_path = '/usr/bin/fluidsynth'
    
    # Command to convert MIDI to WAV using FluidSynth
    command = [fluidsynth_path, '-ni', soundfont_path, midi_file, '-F', wav_file]
    
    try:
        result = subprocess.run(command, check=True)
        print(f"FluidSynth conversion completed successfully: {result}")
    except subprocess.CalledProcessError as e:
        print(f"FluidSynth conversion failed: {e}")

def create_midi_from_notes(notes, output_midi_path, tempo=120):
    # Create a NoteSequence from the provided notes
    sequence = music_pb2.NoteSequence()
    sequence.tempos.add(qpm=tempo)
    
    for note in notes:
        sequence.notes.add(
            pitch=int(note['pitch']),  # Ensure pitch is an integer
            start_time=note['start_time'],
            end_time=note['end_time'],
            velocity=80
        )
    
    # Save the NoteSequence as a MIDI file
    note_seq.midi_io.sequence_proto_to_midi_file(sequence, output_midi_path)

@app.route('/generate_audio', methods=['POST'])
def generate_audio():
    data = request.json
    notes = data.get('notes', [])
    tempo = data.get('tempo', 120)

    output_midi_path = 'output_sequence.mid'
    output_wav_path = '/app/Lyrical/output_sequence.wav'

    # Create MIDI file from the provided notes without generating anything new
    create_midi_from_notes(notes, output_midi_path, tempo)

    # Convert the MIDI file to a WAV audio file
    convert_midi_to_wav(output_midi_path, output_wav_path)
    
    # Return the generated WAV file to the frontend
    return send_file(output_wav_path, as_attachment=True)

# This endpoint will handle the file download request
@app.route('/download', methods=['GET'])
def download_file():
    file_name = request.args.get('file')
    
    if not file_name:
        return jsonify({"message": "No file specified"}), 400
    
    try:
        file_path = os.path.join('/tmp', file_name)
        
        if os.path.exists(file_path):
            return send_file(file_path, as_attachment=True)
        else:
            return jsonify({"message": "File not found"}), 404
        
    except Exception as e:
        return jsonify({"message": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
