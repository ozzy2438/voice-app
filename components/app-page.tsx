'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Mic, MicOff, Settings, History, Wand2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { motion, AnimatePresence } from 'framer-motion'

export function AppPage() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [pastTranscripts, setPastTranscripts] = useState<string[]>([])
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioChunks = useRef<Blob[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  useEffect(() => {
    if (isRecording) {
      startVisualization()
    } else {
      stopVisualization()
    }
  }, [isRecording])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder.current = new MediaRecorder(stream)
      audioChunks.current = []

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data)
      }

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' })
        await sendAudioToServer(audioBlob)
      }

      mediaRecorder.current.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error accessing microphone:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop()
      setIsRecording(false)
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
      setTranscript(data.transcript)
      setPastTranscripts(prev => [...prev, data.transcript])
    } catch (error) {
      console.error('Error sending audio to server:', error)
    }
  }

  const startVisualization = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!audioContext) {
      const newAudioContext = new (window.AudioContext || window.webkitAudioContext)()
      setAudioContext(newAudioContext)
      analyserRef.current = newAudioContext.createAnalyser()
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        if (audioContext && analyserRef.current) {
          const source = audioContext.createMediaStreamSource(stream)
          source.connect(analyserRef.current)
          visualize()
        }
      })

    function visualize() {
      const WIDTH = canvas.width
      const HEIGHT = canvas.height

      if (analyserRef.current) {
        analyserRef.current.fftSize = 256
        const bufferLength = analyserRef.current.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        ctx.clearRect(0, 0, WIDTH, HEIGHT)

        function draw() {
          if (!isRecording) return
          requestAnimationFrame(draw)

          analyserRef.current?.getByteFrequencyData(dataArray)

          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
          ctx.fillRect(0, 0, WIDTH, HEIGHT)

          const barWidth = (WIDTH / bufferLength) * 2.5
          let barHeight
          let x = 0

          for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2

            const hue = (i / bufferLength) * 360
            ctx.fillStyle = `hsl(${hue}, 100%, 50%)`
            ctx.fillRect(x, HEIGHT - barHeight / 2, barWidth, barHeight)

            x += barWidth + 1
          }
        }

        draw()
      }
    }

    // ... geri kalan startVisualization kodu ...
  }

  const stopVisualization = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (audioContext) {
      audioContext.close().then(() => {
        setAudioContext(null)
        analyserRef.current = null
      })
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 min-h-screen">
      <motion.h1 
        className="text-4xl font-bold mb-6 text-center text-white drop-shadow-lg"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Voice to Text Transcription
      </motion.h1>
      <Tabs defaultValue="record" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white bg-opacity-20 rounded-lg p-1">
          <TabsTrigger value="record" className="text-white data-[state=active]:bg-white data-[state=active]:text-purple-600">Record</TabsTrigger>
          <TabsTrigger value="history" className="text-white data-[state=active]:bg-white data-[state=active]:text-purple-600">History</TabsTrigger>
          <TabsTrigger value="settings" className="text-white data-[state=active]:bg-white data-[state=active]:text-purple-600">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="record">
          <Card className="bg-white bg-opacity-10 backdrop-blur-lg border-none text-white">
            <CardContent className="pt-6">
              <div className="flex justify-center mb-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button 
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`${isRecording ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"} text-white font-bold py-2 px-4 rounded-full transition-all duration-300 ease-in-out transform hover:scale-105`}
                  >
                    {isRecording ? <MicOff className="mr-2 h-5 w-5" /> : <Mic className="mr-2 h-5 w-5" />}
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                  </Button>
                </motion.div>
              </div>
              <canvas ref={canvasRef} width="640" height="100" className="w-full mb-4 rounded-lg"></canvas>
              <AnimatePresence>
                {transcript && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-white bg-opacity-20 p-4 rounded-md min-h-[200px] backdrop-blur-md"
                  >
                    <p className="text-white">{transcript}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card className="bg-white bg-opacity-10 backdrop-blur-lg border-none text-white">
            <CardContent>
              <h2 className="text-2xl font-semibold mb-4 flex items-center">
                <History className="mr-2" /> Transcription History
              </h2>
              <div className="space-y-2">
                {pastTranscripts.map((t, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white bg-opacity-20 p-3 rounded-md backdrop-blur-sm"
                  >
                    <p className="text-sm">{t}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="settings">
          <Card className="bg-white bg-opacity-10 backdrop-blur-lg border-none text-white">
            <CardContent>
              <h2 className="text-2xl font-semibold mb-4 flex items-center">
                <Settings className="mr-2" /> Settings
              </h2>
              <p className="text-white">Settings options will be added here in future updates.</p>
              <div className="mt-4">
                <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full transition-all duration-300 ease-in-out transform hover:scale-105">
                  <Wand2 className="mr-2 h-4 w-4" /> Customize Theme
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}