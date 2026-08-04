"use client"

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  PackageSearch,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react"

import styles from "./catalogo.module.css"

type Variant = {
  id: string | number
  label: string
  values: string[]
  price: number
  promotional_price: number
  stock: number | null
  available: boolean
  image?: string | null
}

type Product = {
  id: string | number
  name: string
  description: string
  image?: string | null
  images: string[]
  price: number
  promotional_price: number
  categories: Array<{
    id: string | number
    name: string
    handle: string
  }>
  variants: Variant[]
}

type CartItem = {
  key: string
  productId: string | number
  variantId: string | number
  name: string
  variant: string
  image?: string | null
  price: number
  quantity: number
  stock: number | null
}

type CatalogResponse = {
  ok: boolean
  products: Product[]
  categories: Array<{
    id: string | number
    name: string
    handle: string
  }>
  minimumOrder: number
  pagination: {
    page: number
    total: number
    totalPages: number
  }
  error?: string
}

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
})

const CART_KEY = "moda-pink-catalog-cart-v1"

function itemPrice(variant: Variant) {
  return Number(variant.promotional_price) > 0
    ? Number(variant.promotional_price)
    : Number(variant.price)
}

function ProductImage({
  src,
  alt
}: {
  src?: string | null
  alt: string
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className={styles.imageFallback} aria-label="Produto sem foto">
        <ShoppingBag size={28} />
        <span>Foto indisponível</span>
      </div>
    )
  }

  return (
    // A Nuvemshop entrega as imagens em domínios variados.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

export default function CatalogClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""
  const highlightedProduct = searchParams.get("produto") || ""

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] =
    useState<CatalogResponse["categories"]>([])
  const [minimumOrder, setMinimumOrder] = useState(200)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [category, setCategory] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null)
  const [selectedImage, setSelectedImage] = useState(0)
  const [cartOpen, setCartOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    cep: ""
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [success, setSuccess] = useState<null | {
    id: string
    mode: string
    checkout?: { url?: string; checkout_url?: string }
  }>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 350)

    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CART_KEY)
      if (saved) setCart(JSON.parse(saved))
    } catch {
      window.localStorage.removeItem(CART_KEY)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "48"
      })

      if (debouncedSearch) params.set("query", debouncedSearch)
      if (category) params.set("category", category)

      const response = await fetch(`/api/catalog/products?${params}`, {
        cache: "no-store"
      })
      const data = (await response.json()) as CatalogResponse

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Não foi possível abrir o catálogo.")
      }

      setProducts(data.products || [])
      setCategories(data.categories || [])
      setMinimumOrder(Number(data.minimumOrder || 200))
      setTotalPages(Number(data.pagination?.totalPages || 1))
      setTotalProducts(Number(data.pagination?.total || 0))

      if (highlightedProduct && !selected) {
        const target = data.products?.find(
          product => String(product.id) === highlightedProduct
        )
        if (target) openProduct(target)
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível abrir o catálogo."
      )
    } finally {
      setLoading(false)
    }
    // `selected` não deve disparar uma nova busca ao abrir o produto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, category, highlightedProduct])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  function openProduct(product: Product) {
    setSelected(product)
    setSelectedVariant(
      product.variants.length === 1
        ? product.variants[0]
        : null
    )
    setSelectedImage(0)
  }

  function closeProduct() {
    setSelected(null)
    setSelectedVariant(null)
  }

  function addSelected() {
    if (!selected || !selectedVariant) return

    const key = `${selected.id}:${selectedVariant.id}`
    const price = itemPrice(selectedVariant)

    setCart(current => {
      const found = current.find(item => item.key === key)

      if (found) {
        return current.map(item =>
          item.key === key
            ? {
                ...item,
                quantity: Math.min(
                  item.quantity + 1,
                  item.stock === null ? 100 : item.stock
                )
              }
            : item
        )
      }

      return [
        ...current,
        {
          key,
          productId: selected.id,
          variantId: selectedVariant.id,
          name: selected.name,
          variant: selectedVariant.label,
          image: selectedVariant.image || selected.image,
          price,
          quantity: 1,
          stock: selectedVariant.stock
        }
      ]
    })

    closeProduct()
    setCartOpen(true)
  }

  function updateQuantity(key: string, delta: number) {
    setCart(current =>
      current
        .map(item => {
          if (item.key !== key) return item

          const maximum = item.stock === null ? 100 : item.stock

          return {
            ...item,
            quantity: Math.min(
              Math.max(item.quantity + delta, 0),
              maximum
            )
          }
        })
        .filter(item => item.quantity > 0)
    )
  }

  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  )

  const cartTotal = useMemo(
    () =>
      Number(
        cart
          .reduce((sum, item) => sum + item.price * item.quantity, 0)
          .toFixed(2)
      ),
    [cart]
  )

  const missingMinimum = Math.max(minimumOrder - cartTotal, 0)
  const progress = Math.min((cartTotal / minimumOrder) * 100, 100)

  async function submitCart(event: FormEvent) {
    event.preventDefault()
    setSubmitError("")

    if (missingMinimum > 0) {
      setSubmitError(
        `Faltam ${currency.format(missingMinimum)} para o pedido mínimo.`
      )
      return
    }

    if (!customer.name.trim() || customer.phone.replace(/\D/g, "").length < 10) {
      setSubmitError("Preencha seu nome e um WhatsApp válido.")
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch("/api/catalog/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          customer,
          items: cart.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity
          }))
        })
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Não foi possível enviar seu carrinho.")
      }

      setSuccess(data)

      if (data.mode === "checkout" && data.checkout?.url) {
        window.location.href = data.checkout.url
      }
    } catch (reason) {
      setSubmitError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível enviar seu carrinho."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const modalImages = selected
    ? Array.from(
        new Set([selectedVariant?.image, ...selected.images, selected.image].filter(Boolean))
      ) as string[]
    : []

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a className={styles.brand} href="/catalogo" aria-label="Catálogo Moda Pink">
            <span>MODA</span>
            <strong>PINK</strong>
            <small>ATACADO</small>
          </a>

          <button
            type="button"
            className={styles.cartButton}
            onClick={() => setCartOpen(true)}
            aria-label={`Abrir sacola com ${itemCount} peças`}
          >
            <ShoppingBag size={21} />
            <span>Sacola</span>
            {itemCount > 0 && <b>{itemCount}</b>}
          </button>
        </div>
      </header>

      {!token && (
        <div className={styles.demoBanner}>
          <Check size={16} />
          <span>
            Modo demonstração: monte e teste o carrinho sem enviar pedido real.
          </span>
        </div>
      )}

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Escolha do seu jeito</span>
          <h1>Monte seu pedido com facilidade</h1>
          <p>Selecione o modelo, a opção e a quantidade. A gente cuida do resto.</p>
        </div>
      </section>

      <section className={styles.catalog}>
        <div className={styles.searchBox}>
          <Search size={19} />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar cropped, conjunto, calça..."
            aria-label="Buscar produtos"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca">
              <X size={18} />
            </button>
          )}
        </div>

        <div className={styles.categories} aria-label="Categorias">
          <button
            type="button"
            className={!category ? styles.categoryActive : ""}
            onClick={() => {
              setCategory("")
              setPage(1)
            }}
          >
            Todos
          </button>
          {categories.map(item => (
            <button
              type="button"
              key={item.id}
              className={category === item.handle ? styles.categoryActive : ""}
              onClick={() => {
                setCategory(item.handle)
                setPage(1)
              }}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className={styles.resultsHeader}>
          <h2>{category ? "Peças da categoria" : "Nossas peças"}</h2>
          {!loading && !error && <span>{totalProducts} produtos</span>}
        </div>

        {loading && (
          <div className={styles.grid} aria-label="Carregando produtos">
            {Array.from({ length: 8 }).map((_, index) => (
              <div className={styles.skeleton} key={index}>
                <div />
                <span />
                <small />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className={styles.emptyState}>
            <PackageSearch size={42} />
            <h2>O catálogo não abriu desta vez</h2>
            <p>{error}</p>
            <button type="button" onClick={() => void loadProducts()}>
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div className={styles.emptyState}>
            <PackageSearch size={42} />
            <h2>Não achamos essa peça</h2>
            <p>Tente outro nome ou veja todas as categorias.</p>
            <button
              type="button"
              onClick={() => {
                setSearch("")
                setCategory("")
              }}
            >
              Ver todos os produtos
            </button>
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <div className={styles.grid}>
            {products.map(product => (
              <article className={styles.productCard} key={product.id}>
                <button
                  type="button"
                  className={styles.productImage}
                  onClick={() => openProduct(product)}
                  aria-label={`Ver ${product.name}`}
                >
                  <ProductImage src={product.image} alt={product.name} />
                </button>

                <div className={styles.productInfo}>
                  <h3>{product.name}</h3>
                  <span className={styles.priceLabel}>a partir de</span>
                  <strong>{currency.format(product.price)}</strong>
                  <small>10% de desconto no Pix</small>
                  <button type="button" onClick={() => openProduct(product)}>
                    Escolher opções
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && !error && totalPages > 1 && (
          <nav className={styles.pagination} aria-label="Páginas do catálogo">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(current => Math.max(current - 1, 1))}
            >
              <ChevronLeft size={18} /> Anterior
            </button>
            <span>Página {page} de {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(current => Math.min(current + 1, totalPages))}
            >
              Próxima <ChevronRight size={18} />
            </button>
          </nav>
        )}
      </section>

      {selected && (
        <div className={styles.overlay} onMouseDown={closeProduct}>
          <section
            className={styles.productModal}
            onMouseDown={event => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={selected.name}
          >
            <button className={styles.closeButton} type="button" onClick={closeProduct}>
              <X size={21} />
            </button>

            <div className={styles.modalGallery}>
              <div className={styles.modalMainImage}>
                <ProductImage
                  src={modalImages[selectedImage] || selected.image}
                  alt={selected.name}
                />
              </div>
              {modalImages.length > 1 && (
                <div className={styles.thumbnails}>
                  {modalImages.map((image, index) => (
                    <button
                      type="button"
                      key={`${image}-${index}`}
                      className={selectedImage === index ? styles.thumbnailActive : ""}
                      onClick={() => setSelectedImage(index)}
                    >
                      <ProductImage src={image} alt={`${selected.name} ${index + 1}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.modalContent}>
              <span className={styles.modalTag}>Moda Pink Atacado</span>
              <h2>{selected.name}</h2>
              <strong className={styles.modalPrice}>
                {currency.format(
                  selectedVariant ? itemPrice(selectedVariant) : selected.price
                )}
              </strong>
              <p className={styles.pixPrice}>10% de desconto no Pix</p>

              <div className={styles.options}>
                <h3>Escolha a opção</h3>
                <div>
                  {selected.variants.map(variant => (
                    <button
                      type="button"
                      key={variant.id}
                      className={selectedVariant?.id === variant.id ? styles.optionActive : ""}
                      onClick={() => {
                        setSelectedVariant(variant)
                        if (variant.image) {
                          const index = modalImages.indexOf(variant.image)
                          if (index >= 0) setSelectedImage(index)
                        }
                      }}
                    >
                      {variant.label}
                      {variant.stock !== null && variant.stock <= 3 && (
                        <small>restam {variant.stock}</small>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className={styles.addButton}
                disabled={!selectedVariant}
                onClick={addSelected}
              >
                <ShoppingBag size={19} />
                {selectedVariant ? "Adicionar à sacola" : "Escolha uma opção"}
              </button>
            </div>
          </section>
        </div>
      )}

      {cartOpen && (
        <div className={styles.overlay} onMouseDown={() => setCartOpen(false)}>
          <aside
            className={styles.cartDrawer}
            onMouseDown={event => event.stopPropagation()}
            aria-label="Sua sacola"
          >
            <div className={styles.cartHeader}>
              <div>
                <span>Sua seleção</span>
                <h2>{itemCount} {itemCount === 1 ? "peça" : "peças"}</h2>
              </div>
              <button type="button" onClick={() => setCartOpen(false)} aria-label="Fechar sacola">
                <X size={22} />
              </button>
            </div>

            {success ? (
              <div className={styles.successState}>
                <div><Check size={30} /></div>
                <h2>Carrinho validado!</h2>
                <p>
                  {success.mode === "preview"
                    ? "Este é o teste seguro. Nenhum pedido real foi criado."
                    : "Seu carrinho foi recebido e o checkout está pronto."}
                </p>
                <small>Código: {success.id.slice(0, 8)}</small>
                <button
                  type="button"
                  onClick={() => {
                    setSuccess(null)
                    setCartOpen(false)
                  }}
                >
                  Continuar vendo o catálogo
                </button>
              </div>
            ) : cart.length === 0 ? (
              <div className={styles.emptyCart}>
                <ShoppingBag size={42} />
                <h2>Sua sacola está vazia</h2>
                <p>Escolha uma peça e ela aparece aqui.</p>
                <button type="button" onClick={() => setCartOpen(false)}>
                  Ver produtos
                </button>
              </div>
            ) : (
              <>
                <div className={styles.minimumBox}>
                  <div>
                    <strong>
                      {missingMinimum > 0
                        ? `Faltam ${currency.format(missingMinimum)}`
                        : "Pedido mínimo alcançado!"}
                    </strong>
                    <span>Pedido mínimo: {currency.format(minimumOrder)}</span>
                  </div>
                  <div className={styles.progressTrack}>
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className={styles.cartItems}>
                  {cart.map(item => (
                    <article key={item.key} className={styles.cartItem}>
                      <div className={styles.cartItemImage}>
                        <ProductImage src={item.image} alt={item.name} />
                      </div>
                      <div className={styles.cartItemInfo}>
                        <h3>{item.name}</h3>
                        <p>{item.variant}</p>
                        <strong>{currency.format(item.price)}</strong>
                        <div className={styles.quantity}>
                          <button type="button" onClick={() => updateQuantity(item.key, -1)}>
                            {item.quantity === 1 ? <Trash2 size={16} /> : <Minus size={16} />}
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.key, 1)}
                            disabled={item.stock !== null && item.quantity >= item.stock}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <form className={styles.checkoutForm} onSubmit={submitCart}>
                  <div className={styles.totalLine}>
                    <span>Total das peças</span>
                    <strong>{currency.format(cartTotal)}</strong>
                  </div>

                  <h3>Seus dados</h3>
                  <label>
                    Nome
                    <input
                      value={customer.name}
                      onChange={event => setCustomer(current => ({ ...current, name: event.target.value }))}
                      placeholder="Seu nome completo"
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    WhatsApp
                    <input
                      value={customer.phone}
                      onChange={event => setCustomer(current => ({ ...current, phone: event.target.value }))}
                      placeholder="(31) 99999-9999"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </label>
                  <div className={styles.formRow}>
                    <label>
                      E-mail
                      <input
                        value={customer.email}
                        onChange={event => setCustomer(current => ({ ...current, email: event.target.value }))}
                        placeholder="voce@email.com"
                        inputMode="email"
                        autoComplete="email"
                      />
                    </label>
                    <label>
                      CEP
                      <input
                        value={customer.cep}
                        onChange={event => setCustomer(current => ({ ...current, cep: event.target.value }))}
                        placeholder="00000-000"
                        inputMode="numeric"
                        autoComplete="postal-code"
                      />
                    </label>
                  </div>

                  {submitError && <p className={styles.formError}>{submitError}</p>}

                  <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={submitting || missingMinimum > 0}
                  >
                    {submitting
                      ? "Validando peças..."
                      : token
                        ? "Enviar seleção"
                        : "Testar envio do carrinho"}
                  </button>
                  <small className={styles.secureNote}>
                    Preços e estoque são conferidos novamente antes do envio.
                  </small>
                </form>
              </>
            )}
          </aside>
        </div>
      )}

      {itemCount > 0 && !cartOpen && (
        <button type="button" className={styles.floatingCart} onClick={() => setCartOpen(true)}>
          <span><ShoppingBag size={20} /> {itemCount} peças</span>
          <strong>{currency.format(cartTotal)}</strong>
        </button>
      )}
    </main>
  )
}
