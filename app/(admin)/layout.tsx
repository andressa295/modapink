import Sidebar from "../components/layout/Sidebar"
import Topbar from "../components/layout/Topbar"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Sidebar */}
      <Sidebar />

      {/* Área principal */}
      <div className="flex-1 flex flex-col">

        {/* Topbar */}
        <Topbar />

        {/* Conteúdo */}
        <main className="flex-1 px-10 py-8">
          <div className="max-w-[1600px] w-full">
            {children}
          </div>
        </main>

      </div>

    </div>
  )
}