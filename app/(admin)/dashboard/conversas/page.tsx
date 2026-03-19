import ChatFilters from "../components/chat/ChatFilters"
import ChatList from "../components/chat/ChatList"
import ChatWindow from "../components/chat/ChatWindow"
import ChatInfo from "../components/chat/ChatInfo"

import "../styles/chat.css"

export default function Conversas() {

  return (
    <div className="chat-layout">

      <ChatFilters />

      <ChatList />

      <ChatWindow />

      <ChatInfo />

    </div>
  )
}