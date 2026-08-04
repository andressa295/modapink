"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  HelpCircle,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X
} from "lucide-react"

import type {
  CatalogProduct,
  CatalogResponse
} from "@/lib/catalog/types"

import styles from "./catalog.module.css"

type CartLine = {
  productId: number
  variantId: number
  productName: string
  image: string
  values: string[]
  attributes: string[]
  quantity: number
  price: number
  pixPrice: number
  stock: number | null
}

type CheckoutForm = {
  name: string
  email: string
  phone: string
}

const CART_KEY = "modapink-catalog-cart-v1"

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value)
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function safeExternalUrl(value: string) {
  if (!value) {
    return "#"
  }

  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

export default function CatalogClient({
  sourceToken = "catalogo"
}: {
  sourceToken?: string
}) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<number | "all">("all")
  const [cart, setCart] = useState<CartLine[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [product, setProduct] = useState<CatalogProduct | null>(null)
  const [selectedValues, setSelectedValues] = useState<string[]>([])
  const [quantity, setQuantity] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
    name: "",
    email: "",
    phone: ""
  })
  const [checkoutError, setCheckoutError] = useState("")
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CART_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setCart(parsed)
        }
      }
    } catch {
      window.localStorage.removeItem(CART_KEY)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError("")

      try {
        const response = await fetch("/api/catalog/products", {
          cache: "no-store"
        })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.error || "Não foi possível abrir o catálogo.")
        }

        const catalogData =
          data as CatalogResponse

        setCatalog(catalogData)

        const params =
          new URLSearchParams(
            window.location.search
          )

        const requestedProductId =
          Number(
            params.get("produto") || 0
          )

        const requestedSearch =
          String(
            params.get("busca") || ""
          ).trim()

        const requestedProduct =
          Number.isInteger(requestedProductId) &&
          requestedProductId > 0
            ? catalogData.products.find(
                item =>
                  item.id === requestedProductId
              )
            : null

        if (requestedProduct) {
          const initialVariant =
            requestedProduct.variants.find(
              variant => variant.available
            ) ||
            requestedProduct.variants[0]

          setProduct(requestedProduct)
          setSelectedValues(
            initialVariant?.values || []
          )
          setQuantity(1)
          setImageIndex(0)
          setAdded(false)
        } else if (requestedSearch) {
          setSearch(requestedSearch)
        }
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Não foi possível abrir o catálogo."
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  useEffect(() => {
    const shouldLock = cartOpen || Boolean(product) || checkoutOpen
    document.body.style.overflow = shouldLock ? "hidden" : ""

    return () => {
      document.body.style.overflow = ""
    }
  }, [cartOpen, product, checkoutOpen])

  const visibleProducts = useMemo(() => {
    if (!catalog) {
      return []
    }

    const term = normalize(search.trim())

    return catalog.products.filter(item => {
      const matchesCategory =
        category === "all" ||
        item.categories.some(entry => entry.id === category)
      const searchable = normalize(
        [
          item.name,
          item.description,
          item.categories.map(entry => entry.name).join(" ")
        ].join(" ")
      )

      return matchesCategory && (!term || searchable.includes(term))
    })
  }, [catalog, category, search])

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )
  const minimum = catalog?.settings.minimumOrder || 200
  const amountMissing = Math.max(0, minimum - cartTotal)
  const progress = minimum > 0
    ? Math.min(100, (cartTotal / minimum) * 100)
    : 100

  const selectedVariant = useMemo(() => {
    if (!product) {
      return null
    }

    return product.variants.find(variant =>
      variant.available &&
      variant.values.every((value, index) => selectedValues[index] === value)
    ) || null
  }, [product, selectedValues])

  function openProduct(nextProduct: CatalogProduct) {
    const initialVariant =
      nextProduct.variants.find(variant => variant.available) ||
      nextProduct.variants[0]

    setProduct(nextProduct)
    setSelectedValues(initialVariant?.values || [])
    setQuantity(1)
    setImageIndex(0)
    setAdded(false)
  }

  function closeProduct() {
    setProduct(null)
    setAdded(false)
  }

  function optionAvailable(attributeIndex: number, value: string) {
    if (!product) {
      return false
    }

    return product.variants.some(variant =>
      variant.available && variant.values[attributeIndex] === value
    )
  }

  function chooseOption(attributeIndex: number, value: string) {
    if (!product) {
      return
    }

    const nextValues = [...selectedValues]
    nextValues[attributeIndex] = value

    const compatible = product.variants.find(variant =>
      variant.available &&
      variant.values[attributeIndex] === value &&
      variant.values.every((entry, index) =>
        index === attributeIndex ||
        !nextValues[index] ||
        nextValues[index] === entry
      )
    ) || product.variants.find(variant =>
      variant.available && variant.values[attributeIndex] === value
    )

    setSelectedValues(compatible?.values || nextValues)
    setQuantity(1)
    setAdded(false)
  }

  function addToCart() {
    if (!product || !selectedVariant) {
      return
    }

    setCart(current => {
      const existing = current.find(item => item.variantId === selectedVariant.id)
      const maximum = selectedVariant.stock ?? 100

      if (existing) {
        return current.map(item =>
          item.variantId === selectedVariant.id
            ? {
                ...item,
                quantity: Math.min(maximum, item.quantity + quantity),
                price: selectedVariant.price,
                pixPrice: selectedVariant.pixPrice,
                stock: selectedVariant.stock
              }
            : item
        )
      }

      return [
        ...current,
        {
          productId: product.id,
          variantId: selectedVariant.id,
          productName: product.name,
          image: product.images[0] || "",
          values: selectedVariant.values,
          attributes: product.attributes,
          quantity: Math.min(maximum, quantity),
          price: selectedVariant.price,
          pixPrice: selectedVariant.pixPrice,
          stock: selectedVariant.stock
        }
      ]
    })

    setAdded(true)
    window.setTimeout(() => setAdded(false), 1600)
  }

  function updateCartQuantity(variantId: number, nextQuantity: number) {
    setCart(current => current
      .map(item => {
        if (item.variantId !== variantId) {
          return item
        }

        return {
          ...item,
          quantity: Math.min(item.stock ?? 100, Math.max(0, nextQuantity))
        }
      })
      .filter(item => item.quantity > 0)
    )
  }

  function openCheckout() {
    if (cart.length === 0 || amountMissing > 0) {
      return
    }

    setCartOpen(false)
    setCheckoutError("")
    setCheckoutOpen(true)
  }

  async function submitCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCheckoutLoading(true)
    setCheckoutError("")

    try {
      const response = await fetch("/api/catalog/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customer: checkoutForm,
          sourceToken,
          items: cart.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity
          }))
        })
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível gerar o checkout.")
      }

      window.localStorage.removeItem(CART_KEY)
      setCart([])
      window.location.assign(safeExternalUrl(data.checkoutUrl))
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o checkout."
      )
    } finally {
      setCheckoutLoading(false)
    }
  }

  function productPriceLabel(item: CatalogProduct) {
    const prices = item.variants
      .filter(variant => variant.available)
      .map(variant => variant.price)
    const hasDifferentPrices = new Set(prices).size > 1

    return `${hasDifferentPrices ? "a partir de " : ""}${money(item.priceFrom)}`
  }

  if (loading) {
    return (
      <main className={styles.statePage}>
        <Image
          src="/modapiink.png"
          alt="Moda Pink"
          width={180}
          height={64}
          priority
        />
        <LoaderCircle className={styles.spinner} size={30} />
        <strong>Preparando as peças para você...</strong>
        <span>Estamos atualizando preços, opções e estoque.</span>
      </main>
    )
  }

  if (loadError || !catalog) {
    return (
      <main className={styles.statePage}>
        <Image
          src="/modapiink.png"
          alt="Moda Pink"
          width={180}
          height={64}
          priority
        />
        <CircleAlert size={34} />
        <strong>O catálogo não carregou agora</strong>
        <span>{loadError}</span>
        <button type="button" onClick={() => window.location.reload()}>
          Tentar novamente
        </button>
      </main>
    )
  }

  return (
    <div className={styles.catalogPage}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Image
            src="/modapiink.png"
            alt={catalog.settings.storeName}
            width={150}
            height={52}
            className={styles.logo}
            priority
          />

          <div className={styles.headerActions}>
            <a
              href={safeExternalUrl(catalog.settings.helpUrl)}
              target="_blank"
              rel="noreferrer"
              className={styles.helpLink}
            >
              <HelpCircle size={18} />
              <span>Preciso de ajuda</span>
            </a>

            <button
              type="button"
              className={styles.cartButton}
              onClick={() => setCartOpen(true)}
              aria-label={`Abrir carrinho com ${itemCount} itens`}
            >
              <ShoppingBag size={20} />
              <span className={styles.cartButtonLabel}>Meu pedido</span>
              {itemCount > 0 && (
                <b>{itemCount}</b>
              )}
            </button>
          </div>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>ATACADO MODA PINK</span>
          <h1>Monte seu pedido do seu jeito</h1>
          <p>
            Escolha as peças, selecione cor e tamanho e finalize com segurança.
          </p>

          <div className={styles.heroBadge}>
            <ShoppingBag size={17} />
            Pedido mínimo de {money(catalog.settings.minimumOrder)}
          </div>
        </div>
      </section>

      <main className={styles.main}>
        <div className={styles.searchRow}>
          <label className={styles.searchBox}>
            <Search size={19} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar por nome ou categoria"
              aria-label="Buscar produtos"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpar busca"
              >
                <X size={17} />
              </button>
            )}
          </label>

          <span className={styles.resultCount}>
            {visibleProducts.length} {visibleProducts.length === 1 ? "peça" : "peças"}
          </span>
        </div>

        <nav className={styles.categories} aria-label="Categorias">
          <button
            type="button"
            className={category === "all" ? styles.activeCategory : ""}
            onClick={() => setCategory("all")}
          >
            Todas
          </button>
          {catalog.categories.map(item => (
            <button
              type="button"
              key={item.id}
              className={category === item.id ? styles.activeCategory : ""}
              onClick={() => setCategory(item.id)}
            >
              {item.name}
            </button>
          ))}
        </nav>

        {visibleProducts.length > 0 ? (
          <section className={styles.productGrid}>
            {visibleProducts.map(item => (
              <article className={styles.productCard} key={item.id}>
                <button
                  type="button"
                  className={styles.productImageButton}
                  onClick={() => openProduct(item)}
                  aria-label={`Ver ${item.name}`}
                >
                  {item.images[0] ? (
                    <img
                      src={item.images[0]}
                      alt={item.name}
                      loading="lazy"
                    />
                  ) : (
                    <span className={styles.noImage}>Sem foto</span>
                  )}
                  {!item.available && (
                    <span className={styles.soldOut}>Esgotado</span>
                  )}
                </button>

                <div className={styles.productInfo}>
                  <div>
                    <span className={styles.productCategory}>
                      {item.categories[0]?.name || "Moda Pink"}
                    </span>
                    <h2>{item.name}</h2>
                  </div>

                  <div className={styles.priceBlock}>
                    {item.compareAtPriceFrom && (
                      <span className={styles.comparePrice}>
                        {money(item.compareAtPriceFrom)}
                      </span>
                    )}
                    <strong>{productPriceLabel(item)}</strong>
                    <small>
                      {catalog.settings.pixDiscountPercent > 0
                        ? `${money(item.pixPriceFrom)} no Pix`
                        : "no Pix ou cartão"}
                    </small>
                  </div>

                  <button
                    type="button"
                    className={styles.chooseButton}
                    onClick={() => openProduct(item)}
                    disabled={!item.available}
                  >
                    {item.available ? "Escolher opções" : "Produto esgotado"}
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <div className={styles.emptySearch}>
            <Search size={28} />
            <strong>Nenhuma peça encontrada</strong>
            <span>Tente buscar por outro nome ou escolha outra categoria.</span>
          </div>
        )}
      </main>

      {itemCount > 0 && !cartOpen && (
        <button
          type="button"
          className={styles.floatingCart}
          onClick={() => setCartOpen(true)}
        >
          <span>
            <ShoppingBag size={19} />
            {itemCount} {itemCount === 1 ? "item" : "itens"}
          </span>
          <strong>{money(cartTotal)}</strong>
        </button>
      )}

      {product && (
        <div className={styles.overlay} role="presentation" onMouseDown={closeProduct}>
          <section
            className={styles.productModal}
            role="dialog"
            aria-modal="true"
            aria-label={product.name}
            onMouseDown={event => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.modalClose}
              onClick={closeProduct}
              aria-label="Fechar produto"
            >
              <X size={21} />
            </button>

            <div className={styles.modalGallery}>
              {product.images[imageIndex] ? (
                <img src={product.images[imageIndex]} alt={product.name} />
              ) : (
                <span className={styles.noImage}>Sem foto</span>
              )}

              {product.images.length > 1 && (
                <>
                  <button
                    type="button"
                    className={`${styles.galleryArrow} ${styles.galleryPrevious}`}
                    onClick={() => setImageIndex(current =>
                      current === 0 ? product.images.length - 1 : current - 1
                    )}
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft size={21} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.galleryArrow} ${styles.galleryNext}`}
                    onClick={() => setImageIndex(current =>
                      current === product.images.length - 1 ? 0 : current + 1
                    )}
                    aria-label="Próxima foto"
                  >
                    <ChevronRight size={21} />
                  </button>
                  <div className={styles.galleryDots}>
                    {product.images.map((_, index) => (
                      <button
                        type="button"
                        key={index}
                        className={imageIndex === index ? styles.activeDot : ""}
                        onClick={() => setImageIndex(index)}
                        aria-label={`Ver foto ${index + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className={styles.modalDetails}>
              <span className={styles.productCategory}>
                {product.categories[0]?.name || "Moda Pink"}
              </span>
              <h2>{product.name}</h2>

              <div className={styles.modalPrice}>
                {selectedVariant?.compareAtPrice && (
                  <span>{money(selectedVariant.compareAtPrice)}</span>
                )}
                <strong>{money(selectedVariant?.price || product.priceFrom)}</strong>
                <small>
                  {catalog.settings.pixDiscountPercent > 0
                    ? `${money(selectedVariant?.pixPrice || product.pixPriceFrom)} no Pix`
                    : "Pix ou cartão"}
                </small>
              </div>

              {product.description && (
                <p className={styles.description}>{product.description}</p>
              )}

              {product.attributes.map((attribute, attributeIndex) => {
                const options = Array.from(new Set(
                  product.variants
                    .map(variant => variant.values[attributeIndex])
                    .filter(Boolean)
                ))

                return (
                  <fieldset className={styles.options} key={`${attribute}-${attributeIndex}`}>
                    <legend>{attribute}</legend>
                    <div>
                      {options.map(option => (
                        <button
                          type="button"
                          key={option}
                          className={selectedValues[attributeIndex] === option
                            ? styles.selectedOption
                            : ""}
                          disabled={!optionAvailable(attributeIndex, option)}
                          onClick={() => chooseOption(attributeIndex, option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )
              })}

              <div className={styles.modalFooter}>
                <div className={styles.quantityControl}>
                  <button
                    type="button"
                    onClick={() => setQuantity(current => Math.max(1, current - 1))}
                    disabled={quantity <= 1}
                    aria-label="Diminuir quantidade"
                  >
                    <Minus size={16} />
                  </button>
                  <span>{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(current =>
                      Math.min(selectedVariant?.stock ?? 100, current + 1)
                    )}
                    disabled={quantity >= (selectedVariant?.stock ?? 100)}
                    aria-label="Aumentar quantidade"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <button
                  type="button"
                  className={`${styles.addButton} ${added ? styles.addedButton : ""}`}
                  disabled={!selectedVariant}
                  onClick={addToCart}
                >
                  {added ? (
                    <><Check size={18} /> Adicionado</>
                  ) : (
                    <><ShoppingBag size={18} /> Adicionar ao pedido</>
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {cartOpen && (
        <div className={styles.overlay} role="presentation" onMouseDown={() => setCartOpen(false)}>
          <aside
            className={styles.cartDrawer}
            role="dialog"
            aria-modal="true"
            aria-label="Meu pedido"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className={styles.drawerHeader}>
              <div>
                <span>SEU CARRINHO</span>
                <h2>Meu pedido</h2>
              </div>
              <button type="button" onClick={() => setCartOpen(false)} aria-label="Fechar carrinho">
                <X size={21} />
              </button>
            </div>

            {cart.length > 0 ? (
              <>
                <div className={styles.cartItems}>
                  {cart.map(item => (
                    <article className={styles.cartItem} key={item.variantId}>
                      <div className={styles.cartItemImage}>
                        {item.image ? (
                          <img src={item.image} alt={item.productName} />
                        ) : (
                          <ShoppingBag size={22} />
                        )}
                      </div>

                      <div className={styles.cartItemInfo}>
                        <strong>{item.productName}</strong>
                        {item.values.length > 0 && (
                          <span>
                            {item.values.map((value, index) =>
                              `${item.attributes[index] || "Opção"}: ${value}`
                            ).join(" · ")}
                          </span>
                        )}
                        <b>{money(item.price * item.quantity)}</b>

                        <div className={styles.cartItemActions}>
                          <div className={styles.smallQuantity}>
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.variantId, item.quantity - 1)}
                              aria-label="Diminuir quantidade"
                            >
                              <Minus size={14} />
                            </button>
                            <span>{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.variantId, item.quantity + 1)}
                              disabled={item.quantity >= (item.stock ?? 100)}
                              aria-label="Aumentar quantidade"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button
                            type="button"
                            className={styles.removeItem}
                            onClick={() => updateCartQuantity(item.variantId, 0)}
                            aria-label="Remover item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className={styles.drawerFooter}>
                  <div className={styles.minimumBox}>
                    <div>
                      <span>
                        {amountMissing > 0
                          ? `Faltam ${money(amountMissing)} para o pedido mínimo`
                          : "Pedido mínimo atingido"}
                      </span>
                      {amountMissing <= 0 && <Check size={16} />}
                    </div>
                    <div className={styles.progressTrack}>
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className={styles.totalRow}>
                    <span>Total</span>
                    <strong>{money(cartTotal)}</strong>
                  </div>
                  <small>Frete e forma de pagamento serão escolhidos no checkout.</small>

                  <button
                    type="button"
                    className={styles.checkoutButton}
                    onClick={openCheckout}
                    disabled={amountMissing > 0}
                  >
                    Finalizar pedido
                  </button>
                  <button
                    type="button"
                    className={styles.continueButton}
                    onClick={() => setCartOpen(false)}
                  >
                    Continuar escolhendo
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.emptyCart}>
                <ShoppingBag size={36} />
                <strong>Seu carrinho está vazio</strong>
                <span>Escolha as peças e monte seu pedido.</span>
                <button type="button" onClick={() => setCartOpen(false)}>
                  Ver produtos
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {checkoutOpen && (
        <div className={styles.overlay} role="presentation" onMouseDown={() => setCheckoutOpen(false)}>
          <section
            className={styles.checkoutModal}
            role="dialog"
            aria-modal="true"
            aria-label="Finalizar pedido"
            onMouseDown={event => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setCheckoutOpen(false)}
              aria-label="Fechar"
            >
              <X size={21} />
            </button>

            <span className={styles.eyebrow}>ÚLTIMO PASSO</span>
            <h2>Para quem é este pedido?</h2>
            <p>
              Vamos gerar seu checkout seguro na Nuvemshop com as peças selecionadas.
            </p>

            <form onSubmit={submitCheckout} className={styles.checkoutForm}>
              <label>
                <span>Nome completo</span>
                <input
                  required
                  autoComplete="name"
                  value={checkoutForm.name}
                  onChange={event => setCheckoutForm(current => ({
                    ...current,
                    name: event.target.value
                  }))}
                  placeholder="Seu nome e sobrenome"
                />
              </label>
              <label>
                <span>E-mail</span>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={checkoutForm.email}
                  onChange={event => setCheckoutForm(current => ({
                    ...current,
                    email: event.target.value
                  }))}
                  placeholder="voce@email.com"
                />
              </label>
              <label>
                <span>WhatsApp com DDD</span>
                <input
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  value={checkoutForm.phone}
                  onChange={event => setCheckoutForm(current => ({
                    ...current,
                    phone: event.target.value
                  }))}
                  placeholder="(11) 99999-9999"
                />
              </label>

              {checkoutError && (
                <div className={styles.checkoutError}>
                  <CircleAlert size={17} />
                  <span>{checkoutError}</span>
                </div>
              )}

              <div className={styles.checkoutSummary}>
                <span>{itemCount} {itemCount === 1 ? "item" : "itens"}</span>
                <strong>{money(cartTotal)}</strong>
              </div>

              <button type="submit" disabled={checkoutLoading}>
                {checkoutLoading ? (
                  <><LoaderCircle className={styles.spinner} size={18} /> Gerando checkout...</>
                ) : (
                  <>Ir para o pagamento <ChevronRight size={18} /></>
                )}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
