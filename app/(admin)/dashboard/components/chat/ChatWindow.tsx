import "../../styles/chat.css"

export default function ChatWindow() {

  return (

    <div className="chat-window">

      <div className="chat-header">

        <div className="chat-header-info">

          <div className="chat-client-name">
            Juliana
          </div>

          <div className="chat-client-phone">
            (11) 99999-8888
          </div>

        </div>

        <div className="chat-status">
          🟢 Conversa ativa
        </div>

      </div>


      <div className="chat-messages">

        <div className="message-row">
          <div>
            <div className="message-bubble client">
              Meu pedido não chegou
            </div>
            <div className="message-time">10:32</div>
          </div>
        </div>

        <div className="message-row agent">
          <div>
            <div className="message-bubble agent">
              Oi Juliana! Vou verificar para você.
            </div>
            <div className="message-time">10:33</div>
          </div>
        </div>

      </div>

      <div className="chat-monitor">
        Monitorando conversa — respostas feitas no WhatsApp do atendente
      </div>

    </div>

  )
}