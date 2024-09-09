'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Mic, MicOff, ChevronLeft, ChevronRight, Trash, Save, ExternalLink } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { motion, AnimatePresence } from 'framer-motion'

interface Note {
  id: number;
  title: string;
  content: string;
  timestamp: string;
  url?: string;
}

const RealtimeTranscription = ({ transcript }: { transcript: string }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [lastChunk, setLastChunk] = useState('');
  const typingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (transcript !== lastChunk) {
      const newChunk = transcript.slice(lastChunk.length);
      setLastChunk(transcript);
      typeText(newChunk);
    }
  }, [transcript, lastChunk]);

  const typeText = (text: string) => {
    let index = 0;
    if (typingRef.current) {
      clearInterval(typingRef.current);
    }
    typingRef.current = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(prev => prev + text[index]);
        index++;
      } else {
        clearInterval(typingRef.current as NodeJS.Timeout);
      }
    }, 50) as unknown as NodeJS.Timeout;
  };

  return (
    <motion.div
      className="bg-gray-800 bg-opacity-50 p-4 rounded-lg mt-4 min-h-[100px] relative overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <p className="text-white font-mono text-lg">
        {displayedText}
        <motion.span
          className="inline-block w-2 h-4 bg-blue-400 ml-1"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
        />
      </p>
      <motion.div
        className="absolute bottom-0 left-0 w-full h-1 bg-blue-400"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5 }}
      />
    </motion.div>
  );
}

export default function VoiceNotes() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [editedContent, setEditedContent] = useState("")
  const [noteTitle, setNoteTitle] = useState("")
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioChunks = useRef<Blob[]>([])
  const [showSource, setShowSource] = useState(false)
  const [waveform, setWaveform] = useState<number[]>(Array(50).fill(0.5))
  const animationFrameRef = useRef<number>()
  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [realtimeTranscript, setRealtimeTranscript] = useState("")
  const [lastTranscriptChunk, setLastTranscriptChunk] = useState("")

  useEffect(() => {
    if (isRecording) {
      animateWaveform()
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isRecording])

  const animateWaveform = () => {
    setWaveform(prev => prev.map(() => Math.random() * 0.5 + 0.25))
    animationFrameRef.current = requestAnimationFrame(animateWaveform)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder.current = new MediaRecorder(stream)
      audioChunks.current = []

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data)
        sendAudioChunkForTranscription(event.data)
      }

      mediaRecorder.current.start(1000) // Her saniye veri gönder
      setIsRecording(true)
      setTranscript("")
      setRealtimeTranscript("")
      setLastTranscriptChunk("")
    } catch (error) {
      console.error('Error accessing microphone:', error)
    }
  }

  const stopRecording = async () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop()
      setIsRecording(false)
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' })
      await sendAudioToServer(audioBlob)
    }
  }

  const sendAudioChunkForTranscription = async (audioBlob: Blob) => {
    const formData = new FormData()
    formData.append('audio', audioBlob)

    try {
      const response = await fetch('/api/transcribe-realtime', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        const newTranscript = data.transcript.trim()
        if (newTranscript && newTranscript !== lastTranscriptChunk) {
          setLastTranscriptChunk(newTranscript)
          setTranscript(prev => prev + " " + newTranscript)
          setRealtimeTranscript(prev => prev + " " + newTranscript)
        }
      } else {
        console.error('Transcription failed:', await response.text())
      }
    } catch (error) {
      console.error('Error in real-time transcription:', error)
    }
  }

  const sendAudioToServer = async (audioBlob: Blob) => {
    const formData = new FormData()
    formData.append('audio', audioBlob)

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Transcription failed')
      }

      const data = await response.json()
      addNote(data.transcript)
    } catch (error) {
      console.error('Error sending audio to server:', error)
    }
  }

  const addNote = (content: string) => {
    const newNote: Note = {
      id: Date.now(),
      title: `Not ${notes.length + 1}`,
      content: content,
      timestamp: new Date().toLocaleString(),
      url: window.location.href
    }
    setNotes(prevNotes => [newNote, ...prevNotes])
  }

  const openNoteDetails = (note: Note) => {
    setSelectedNote(note)
    setEditedContent(note.content)
    setNoteTitle(note.title)
    setShowSource(false)
  }

  const closeNoteDetails = () => {
    setSelectedNote(null)
    setEditedContent("")
    setNoteTitle("")
  }

  const navigateNotes = (direction: 'left' | 'right') => {
    if (selectedNote) {
      const currentIndex = notes.findIndex(note => note.id === selectedNote.id)
      let newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1

      if (newIndex < 0) newIndex = notes.length - 1
      if (newIndex >= notes.length) newIndex = 0

      setSelectedNote(notes[newIndex])
      setEditedContent(notes[newIndex].content)
      setNoteTitle(notes[newIndex].title)
    }
  }

  const deleteNote = () => {
    if (selectedNote) {
      setNotes(notes.filter(note => note.id !== selectedNote.id))
      closeNoteDetails()
    }
  }

  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3000) // Remove toast after 3 seconds
  }

  const saveNote = async () => {
    if (selectedNote) {
      setIsSaving(true)
      try {
        const updatedNote = {
          ...selectedNote,
          content: editedContent,
          title: noteTitle
        }
        
        // Simulate an API call
        await new Promise(resolve => setTimeout(resolve, 500))

        setNotes(notes.map(note => 
          note.id === selectedNote.id ? updatedNote : note
        ))
        
        setSelectedNote(updatedNote)
        showToast("Note saved successfully")
      } catch (error) {
        console.error('Error saving note:', error)
        showToast("Error saving note")
      } finally {
        setIsSaving(false)
      }
    }
  }

  const toggleSourceView = () => {
    setShowSource(!showSource)
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl bg-gradient-to-br from-gray-900 to-blue-900 min-h-screen">
      <h1 className="text-4xl font-bold mb-6 text-center text-white">Voice Notes</h1>
      
      <div className="flex justify-center mb-8">
        <Button 
          onClick={isRecording ? stopRecording : startRecording}
          className={`${isRecording ? "bg-red-600 hover:bg-red-700" : "bg-blue-800 hover:bg-blue-900"} text-white font-bold py-3 px-6 rounded-full`}
        >
          {isRecording ? <MicOff className="mr-2 h-5 w-5" /> : <Mic className="mr-2 h-5 w-5" />}
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </Button>
      </div>

      {isRecording && (
        <Card className="bg-gradient-to-br from-gray-800 to-blue-900 bg-opacity-50 rounded-lg p-4 mb-4">
          <CardContent>
            <div className="flex items-center justify-center mb-4">
              {waveform.map((value, index) => (
                <motion.div
                  key={index}
                  className="bg-blue-400 rounded-full mx-0.5"
                  style={{
                    height: `${value * 40}px`,
                    width: '4px'
                  }}
                  animate={{
                    height: [`${value * 40}px`, `${Math.random() * 40}px`]
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    repeatType: 'reverse'
                  }}
                />
              ))}
            </div>
            <RealtimeTranscription transcript={realtimeTranscript} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {notes.map((note) => (
          <Card key={note.id} className="bg-gradient-to-br from-gray-800 to-blue-900 bg-opacity-50 rounded-lg p-4 cursor-pointer" onClick={() => openNoteDetails(note)}>
            <CardContent>
              <h3 className="text-white font-semibold mb-2">{note.title}</h3>
              <p className="text-sm text-gray-400 mb-2">{note.timestamp}</p>
              <p className="text-white text-sm line-clamp-3">{note.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedNote} onOpenChange={closeNoteDetails}>
        <DialogContent className="bg-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Note Details</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="noteTitle" className="block text-sm font-medium text-gray-400 mb-1">Title</label>
              <input
                id="noteTitle"
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="w-full p-2 bg-gray-700 text-white rounded"
              />
            </div>
            <div>
              <label htmlFor="noteTimestamp" className="block text-sm font-medium text-gray-400 mb-1">Date</label>
              <input
                id="noteTimestamp"
                type="text"
                value={selectedNote?.timestamp}
                readOnly
                className="w-full p-2 bg-gray-700 text-white rounded"
              />
            </div>
          </div>
          <div className="mt-4">
            {showSource && selectedNote?.url ? (
              <iframe 
                src={selectedNote.url} 
                className="w-full h-96 border-none rounded"
                title="Source Page"
              />
            ) : (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-40 p-2 bg-gray-700 text-white rounded resize-none"
              />
            )}
          </div>
          {selectedNote?.url && (
            <button 
              onClick={toggleSourceView}
              className="text-blue-400 hover:text-blue-300 flex items-center mt-2"
            >
              <ExternalLink className="h-4 w-4 mr-1" /> 
              {showSource ? "Hide Source" : "View Original Page"}
            </button>
          )}
          <DialogFooter className="flex justify-between items-center mt-4">
            <div>
              <Button onClick={() => navigateNotes('left')} className="mr-2 bg-gray-700 hover:bg-gray-600">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button onClick={() => navigateNotes('right')} className="bg-gray-700 hover:bg-gray-600">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <Button onClick={deleteNote} className="mr-2 bg-red-600 hover:bg-red-700">
                <Trash className="h-4 w-4 mr-2" /> Delete
              </Button>
              <Button 
                onClick={saveNote} 
                className="bg-green-600 hover:bg-green-700"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" /> Save
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  )
}