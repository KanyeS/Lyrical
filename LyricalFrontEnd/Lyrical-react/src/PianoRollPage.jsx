import React, { useState, useRef, useEffect } from 'react';
import { Piano, KeyboardShortcuts, MidiNumbers } from 'react-piano';
import * as Tone from 'tone';
import 'react-piano/dist/styles.css';
import './App.css';
import SavedNotes from './SavedNotes';
import VariationsTabs from './VariationsTabs';
import spinner from '../public/spinner.gif';

function PianoRollPage() {

    useEffect(() => {
        const customContext = new (window.AudioContext || window.webkitAudioContext)({
          latencyHint: 'interactive'
        });
        Tone.setContext(customContext);
      }, []);

  const firstNote = MidiNumbers.fromNote('c4'); // C4
  const lastNote = MidiNumbers.fromNote('f5');  // F5

  const keyboardShortcuts = KeyboardShortcuts.create({
    firstNote: firstNote,
    lastNote: lastNote,
    keyboardConfig: KeyboardShortcuts.HOME_ROW,
  });

  const [notes, setNotes] = useState([]);
  const [message, setMessage] = useState('');
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [isDownloadAvailable, setIsDownloadAvailable] = useState(false); // Track if download is available
  const [generatedFiles, setGeneratedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);  // Loading state


  const synth = new Tone.PolySynth().toDestination();
  
  const pianoRollRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }
    };
}, []);

  const handleStartAudio = async () => {
    if (Tone.context.state !== 'running') {
      await Tone.context.resume();
      console.log('AudioContext resumed successfully');
    }
  };

  const handlePlayNoteInput = async (midiNumber) => {
    await handleStartAudio();
    const lastEndTime = notes.length > 0 ? notes[notes.length - 1].end_time : 0;

    const note = {
        pitch: midiNumber,
        start_time: lastEndTime,
        end_time: lastEndTime + 1,
        isNew: true,
    };
    setNotes([...notes, note]);

    const noteName = MidiNumbers.getAttributes(midiNumber).note;
    synth.triggerAttackRelease(noteName, "8n");
};

  const midiToNoteName = (midiNumber) => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNumber / 12) - 1;
    const note = notes[midiNumber % 12];
    return `${note}${octave}`;
  };

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

  const [variations, setVariations] = useState([]);
  const [variationCount, setVariationCount] = useState(2);

  const handleVariationCountChange = (e) => {
    setVariationCount(parseInt(e.target.value, 10));
};

const updateSavedNotes = async () => {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_BASE_URL}/api/saved_notes`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      setSavedNotes(data.notes);
    } else {
      console.error('Failed to fetch saved notes:', response.statusText);
    }
  } catch (error) {
    console.error('Error fetching saved notes:', error);
  }
};


const handleSendSequence = async () => {
  const token = localStorage.getItem('token');
  setIsLoading(true);  // Start loading
  try {
      const response = await fetch(`${API_BASE_URL}/submit_notes`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ notes, variations: variationCount }),
      });

      const data = await response.json();
      console.log("Response data:", data);
      setMessage(data.message);

      if (response.ok) {
          setVariations(data.variations);
          const files = data.variation_files || [];
          setGeneratedFiles(files);

          if (files.length > 0) {
              setIsDownloadAvailable(true);
          } else {
              setIsDownloadAvailable(false);
          }
      } else {
          setIsDownloadAvailable(false);
      }
  } catch (error) {
      console.error('Error sending notes:', error);
      setMessage('Failed to send notes');
      setIsDownloadAvailable(false);
  } finally {
      setIsLoading(false);  // Stop loading when process is complete
  }
};

useEffect(() => {
  console.log("Is download available:", isDownloadAvailable);
}, [isDownloadAvailable]);


const onSelectVariation = (variationIndex) => {
  const selectedVariation = variations.find(v => v.variation === variationIndex);
  if (selectedVariation && selectedVariation.notes) {
      const newNotes = selectedVariation.notes.map(note => ({
          pitch: note.pitch,
          start_time: note.start_time,
          end_time: note.end_time,
          isNew: true,  // Mark the note as new
      }));

      // Update the piano roll with the selected variation's notes
      setNotes(newNotes);
  }
};


const handleDownloadGeneratedFiles = async () => {
  const token = localStorage.getItem('token');

  try {
      for (const file of generatedFiles) {
          const response = await fetch(`${API_BASE_URL}/download?file=${encodeURIComponent(file)}`, {
              headers: {
                  'Authorization': `Bearer ${token}`,
              }
          });

          if (!response.ok) {
              setMessage('Failed to download the file');
              continue;
          }

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.href = url;
          a.download = file.split('/').pop();
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
      }
  } catch (error) {
      console.error('Error downloading file:', error);
      setMessage('Failed to download file');
  }
};

  const handlePlaySequenceFromServer = async () => {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${API_BASE_URL}/generate_audio`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ notes, tempo: 120 }),
        });

        if (response.ok) {
            const audioBlob = await response.blob();
            const audioUrl = window.URL.createObjectURL(audioBlob);

            audioRef.current = new Audio(audioUrl);

            const updatePlaybackPosition = () => {
                const currentPosition = audioRef.current.currentTime;
                setPlaybackPosition(currentPosition * 50);

                if (pianoRollRef.current) {
                    pianoRollRef.current.scrollLeft = currentPosition * 50;
                }

                if (!audioRef.current.paused && !audioRef.current.ended) {
                    requestAnimationFrame(updatePlaybackPosition);
                }
            };

            audioRef.current.addEventListener('play', () => {
                requestAnimationFrame(updatePlaybackPosition);
            });

            audioRef.current.play();

        } else {
            console.error('Failed to generate and download the audio file.');
        }

    } catch (error) {
        console.error('Error generating or downloading the audio file:', error);
    }
};

const handleSaveSequenceToSQL = async () => {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_BASE_URL}/save_sequence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ notes }),
    });

    const data = await response.json();
    if (response.ok) {
      setMessage(`Sequence saved: ${data.file_name}`);
      updateSavedNotes(); // Update the saved notes list after saving a new sequence
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Error saving sequence', error);
    setMessage('Failed to save sequence');
  }
};

const handleStopSequence = () => {
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setPlaybackPosition(0);
        if (pianoRollRef.current) {
            pianoRollRef.current.scrollLeft = 0;
        }
    }
};

const handleRestartSequence = () => {
    handleStopSequence();
    if (audioRef.current) {
        audioRef.current.play();
    }
};

  const handleDeleteNote = (index) => {
    const updatedNotes = notes.filter((_, i) => i !== index);
    setNotes(updatedNotes);
  };

  const insertSequenceIntoPianoRoll = (newSequence) => {
    const adjustedSequence = newSequence.map((note, index) => ({
        ...note,
        start_time: index,
        end_time: index + 1 
    }));

    setNotes(adjustedSequence);
};

  const renderNoteBlock = (note, index) => {
    return (
      <div
        className="note-block"
        style={{
          position: 'absolute',
          left: `${note.start_time * 50}px`,
          top: `${(lastNote - note.pitch) * 20}px`,
          width: `${50 * (note.end_time - note.start_time)}px`,
          height: '20px',
          backgroundColor: note.isNew ? 'red' : 'blue',
        }}
        key={index}
        onClick={() => handleDeleteNote(index)}
      >
        {midiToNoteName(note.pitch)}
      </div>
    );
  };

  const gridRows = lastNote - firstNote + 1;

  return (
    <div className="App">
  <div className="saved-notes-section">
    <SavedNotes 
      onInsertSequence={insertSequenceIntoPianoRoll} 
      updateSavedNotes={updateSavedNotes} 
    />
  </div>
  <div className="main-content">
    <header>
      <h1>Piano Roll Visualisation</h1>
    </header>
    
    <main>
      <Piano
        noteRange={{ first: firstNote, last: lastNote }}
        playNote={handlePlayNoteInput}
        stopNote={() => {}}
        width={1000}
        keyboardShortcuts={keyboardShortcuts}
      />

      <div className="piano-roll-container">
        <div
          className="piano-roll"
          ref={pianoRollRef}
          style={{
            gridTemplateRows: `repeat(${gridRows}, 20px)`,
            maxHeight: '450px',
            position: 'relative',
            overflowX: 'scroll',
          }}
        >
          {notes && notes.length > 0 ? (
            notes.map((note, index) => renderNoteBlock(note, index))
          ) : (
            <p>No notes to display</p>
          )}
          <div
                className="scrolling-bar"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${playbackPosition}px`,
                  height: '100%',
                  width: '2px',
                  backgroundColor: 'red',
                  zIndex: 10,
                }}
              />
        </div>
        {isLoading ? (
          <div className="loading-container">
            <img src={spinner} alt="Loading..." />
          </div>
        ) : (
          <VariationsTabs variations={variations} onSelectVariation={onSelectVariation} />
        )}
      </div>

      <div className="controls">
        <button onClick={handleSendSequence}>Generate Sequence</button>
        <button onClick={handlePlaySequenceFromServer}>Play Sequence</button>
        <button onClick={handleStopSequence}>Stop Sequence</button>
        <button onClick={handleRestartSequence}>Restart Sequence</button>
        <button onClick={handleSaveSequenceToSQL}>Save Sequence</button>
        <button 
            onClick={handleDownloadGeneratedFiles} 
            disabled={!isDownloadAvailable}
            style={{
                backgroundColor: isDownloadAvailable ? 'blue' : 'grey',
                cursor: isDownloadAvailable ? 'pointer' : 'not-allowed'
            }}
        >
          Download Generated Files
        </button>

        <div className="variation-count-input">
          <label htmlFor="variation-count">Number of Variations:</label>
          <input
            id="variation-count"
            type="number"
            value={variationCount}
            onChange={handleVariationCountChange}
            min="1"
          />
        </div>
      </div>

      {message && <p className="message">{message}</p>}
    </main>
  </div>
</div>
  );
}

export default PianoRollPage;
