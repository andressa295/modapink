import "../styles/pedidos.css"

export default function Pedidos() {

  const orders = [
    {
      id: "#4821",
      customer: "Juliana",
      status: "shipped",
      total: "R$120",
      date: "12/03"
    },
    {
      id: "#4820",
      customer: "Carla",
      status: "paid",
      total: "R$85",
      date: "12/03"
    },
    {
      id: "#4819",
      customer: "Maria",
      status: "pending",
      total: "R$150",
      date: "11/03"
    }
  ]

  return (

    <div className="pedidos-page">

      <div className="pedidos-header">

        <div className="pedidos-title">
          Pedidos
        </div>

        <div className="pedidos-actions">

          <input
            className="search-order"
            placeholder="Buscar pedido..."
          />

          <button className="connect-store">
            Conectar loja
          </button>

        </div>

      </div>


      <div className="orders-table">

        <div className="orders-row header">
          <div>Pedido</div>
          <div>Cliente</div>
          <div>Status</div>
          <div>Total</div>
          <div>Data</div>
        </div>


        {orders.map((order, index) => (

          <div key={index} className="orders-row">

            <div>{order.id}</div>

            <div>{order.customer}</div>

            <div>

              <span className={`order-status ${
                order.status === "paid"
                ? "status-paid"
                : order.status === "shipped"
                ? "status-shipped"
                : "status-pending"
              }`}>

                {order.status === "paid" && "Pago"}
                {order.status === "shipped" && "Enviado"}
                {order.status === "pending" && "Separação"}

              </span>

            </div>

            <div>{order.total}</div>

            <div>{order.date}</div>

          </div>

        ))}

      </div>

    </div>

  )

}