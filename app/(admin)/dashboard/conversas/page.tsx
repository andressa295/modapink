"use client"

import ChatFilters from "../components/chat/ChatFilters"
import ChatList from "../components/chat/ChatList"
import ChatWindow from "../components/chat/ChatWindow"
import ChatInfo from "../components/chat/ChatInfo"

import { SessionProvider } from "../context/SessionContext"

import "../styles/chat.css"

export default function Conversas() {
  return (
    <SessionProvider>
      <div className="chat-layout">

        <ChatFilters />

        <ChatList />

        <ChatWindow />

        <ChatInfo />

      </div>
    </SessionProvider>
  )
}