"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Activity, ArrowLeft, CheckCircle2, XCircle, Clock, MessageSquare, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface ActivityMessage {
    id: string
    content: string
    status: string
    createdAt: string
    pageName: string
}

export default function ActivityPage() {
    const [messages, setMessages] = useState<ActivityMessage[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchActivity()
    }, [])

    const fetchActivity = async () => {
        try {
            setLoading(true)
            const response = await fetch("/api/activity")
            if (!response.ok) {
                throw new Error("Failed to fetch activity")
            }
            const data = await response.json()
            setMessages(data.messages || [])
        } catch (error) {
            console.error("Error fetching activity:", error)
            toast.error("Failed to load activity logs")
        } finally {
            setLoading(false)
        }
    }

    const formatTimeAgo = (dateString: string): string => {
        const date = new Date(dateString)
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
        if (seconds < 60) return "just now"
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
        const days = Math.floor(hours / 24)
        if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`
        const weeks = Math.floor(days / 7)
        if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`
        const months = Math.floor(days / 30)
        return `${months} month${months !== 1 ? 's' : ''} ago`
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "success":
                return <CheckCircle2 className="h-4 w-4 text-green-500" />
            case "error":
                return <XCircle className="h-4 w-4 text-red-500" />
            default:
                return <Clock className="h-4 w-4 text-muted-foreground" />
        }
    }

    const getStatusText = (status: string) => {
        switch (status) {
            case "success":
                return "Replied"
            case "error":
                return "Failed"
            default:
                return "Pending"
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <Link href="/">
                    <Button variant="ghost" size="sm" className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold tracking-tight">Activity</h1>
                <p className="text-muted-foreground mt-1">
                    Recent message activity and AI reply status
                </p>
            </div>

            {/* Activity Logs */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5" />
                                Recent Messages
                            </CardTitle>
                            <CardDescription>
                                Last 10 inbound messages and their reply status
                            </CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchActivity}
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "Refresh"
                            )}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No messages yet</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Once you receive messages on your connected Facebook Pages, they'll appear here.
                            </p>
                            <Link href="/integrations/facebook">
                                <Button variant="outline">
                                    Connect Facebook Page
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="mt-0.5">
                                        {getStatusIcon(message.status)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4 mb-2">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium line-clamp-2">
                                                    {message.content}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                    <span>{message.pageName}</span>
                                                    <span>•</span>
                                                    <span>{formatTimeAgo(message.createdAt)}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className={`text-xs px-2 py-1 rounded-full ${
                                                    message.status === "success"
                                                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                                        : message.status === "error"
                                                        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                                }`}>
                                                    {getStatusText(message.status)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="border-dashed">
                <CardHeader>
                    <CardTitle className="text-sm">About Activity Logs</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>
                        This page shows the last 10 inbound messages received on your connected Facebook Pages.
                    </p>
                    <p>
                        Status indicators show whether AI successfully replied to each message:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                        <li><strong>Replied:</strong> AI successfully sent a response</li>
                        <li><strong>Failed:</strong> AI encountered an error when replying</li>
                    </ul>
                    <p className="pt-2">
                        This is a read-only view for trust and transparency. For detailed debugging, check your server logs.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}

