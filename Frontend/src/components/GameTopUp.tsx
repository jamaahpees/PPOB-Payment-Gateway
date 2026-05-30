import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Gamepad2, Loader2, RefreshCw, Search, Zap } from 'lucide-react';

import { buildApiUrl, readApiError } from '../lib/api';
import { useMidtransSnap } from '../hooks/useMidtransSnap';

function formatRupiah(amountMinor: number) {
  return 'Rp ' + amountMinor.toLocaleString('id-ID');
}

type TopUpItem = Readonly<{
  label: string;
  amountMinor: number;
}>;

type GameProduct = Readonly<{
  id: number;
  code: string;
  name: string;
  category: string;
  players: string;
  image: string;
  color: string;
  items: TopUpItem[];
  popular: boolean;
}>;

type OrderResponse = Readonly<{
  order_id: string;
  invoice_code: string;
  status: string;
}>;

type PaymentResponse = Readonly<{
  payment_id: string;
  order_id: string;
  status: string;
  token: string;
  redirect_url: string;
}>;

type CatalogProductResponse = Readonly<{
  product: Readonly<{
    id: string;
    sku_digiflazz: string;
    name: string;
    category: string;
    provider: string;
    metadata?: Record<string, unknown>;
  }>;
  final_price_minor: number;
  base_price_minor: number;
  role_type: string;
}>;

type CatalogResponse = Readonly<{
  products: CatalogProductResponse[];
}>;

type DisplayProduct = Readonly<{
  key: string;
  productId: string | null;
  code: string;
  name: string;
  category: string;
  provider: string;
  amountMinor: number;
  subtitle: string;
  image: string;
  color: string;
  popular: boolean;
}>;

const categoryColors = [
  'from-blue-600 to-blue-900',
  'from-emerald-600 to-teal-900',
  'from-orange-500 to-red-700',
  'from-violet-500 to-slate-800',
  'from-amber-500 to-slate-800',
  'from-cyan-500 to-blue-800',
];

const categoryImageByKeyword = [
  { pattern: /mobile\s*legends|mlbb|ml-/i, image: '/product-assets/mobile-legends.jpg' },
  { pattern: /free\s*fire|\bff\b/i, image: '/product-assets/free-fire.jpg' },
  { pattern: /genshin/i, image: '/product-assets/genshin-impact.jpg' },
  { pattern: /pubg/i, image: '/product-assets/pubg-mobile.jpg' },
  { pattern: /pln|listrik/i, image: '/product-assets/pln-token.png' },
  { pattern: /gopay|go pay|e-money|emoney|wallet/i, image: '/product-assets/gopay-emoney.png' },
  { pattern: /data|telkomsel|internet/i, image: '/product-assets/paket-data.png' },
  { pattern: /voucher|google play/i, image: '/product-assets/voucher-digital.png' },
];

const fallbackCategoryImages = [
  '/product-assets/mobile-legends.jpg',
  '/product-assets/free-fire.jpg',
  '/product-assets/pln-token.png',
  '/product-assets/gopay-emoney.png',
  '/product-assets/paket-data.png',
  '/product-assets/voucher-digital.png',
];

function categoryIndex(category: string) {
  return Math.abs([...category].reduce((total, char) => total + char.charCodeAt(0), 0)) % categoryColors.length;
}

function catalogProductToDisplay(item: CatalogProductResponse): DisplayProduct {
  const index = categoryIndex(item.product.category);
  const searchKey = `${item.product.name} ${item.product.category} ${item.product.provider} ${item.product.sku_digiflazz}`;
  const stock = typeof item.product.metadata?.stock === 'number' ? `${item.product.metadata.stock} stok` : 'Produk Digiflazz';
  const uploadedImage =
    typeof item.product.metadata?.image_url === 'string'
      ? item.product.metadata.image_url
      : typeof item.product.metadata?.category_image_url === 'string'
        ? item.product.metadata.category_image_url
        : null;

  return {
    key: item.product.id,
    productId: item.product.id,
    code: item.product.sku_digiflazz,
    name: item.product.name,
    category: item.product.category,
    provider: item.product.provider,
    amountMinor: item.final_price_minor,
    subtitle: `${item.product.provider} · ${stock}`,
    image: uploadedImage ?? categoryImageByKeyword.find((entry) => entry.pattern.test(searchKey))?.image ?? fallbackCategoryImages[index],
    color: categoryColors[index],
    popular: item.role_type === 'seller' || item.final_price_minor <= 25000,
  };
}

function fallbackProducts(): DisplayProduct[] {
  return games.flatMap((game) =>
    game.items.map((item) => ({
      key: `${game.code}-${item.label}`,
      productId: null,
      code: `${game.code}-${item.label.toLowerCase().replace(/\s+/g, '-')}`,
      name: `${game.name} ${item.label}`,
      category: game.category,
      provider: 'digiflazz',
      amountMinor: item.amountMinor,
      subtitle: `${game.players} transaksi / bulan`,
      image: categoryImageByKeyword.find((entry) => entry.pattern.test(`${game.name} ${game.category}`))?.image ?? game.image,
      color: game.color,
      popular: game.popular,
    }))
  );
}

const games: GameProduct[] = [
  {
    id: 1,
    code: 'mobile-legends',
    name: 'Mobile Legends',
    category: 'MOBA',
    players: '500rb+',
    image: 'https://images.pexels.com/photos/3165335/pexels-photo-3165335.jpeg?auto=compress&cs=tinysrgb&w=400',
    color: 'from-blue-600 to-blue-900',
    items: [
      { label: '86 Diamond', amountMinor: 20000 },
      { label: '172 Diamond', amountMinor: 40000 },
      { label: '257 Diamond', amountMinor: 60000 },
      { label: '600 Diamond', amountMinor: 135000 },
    ],
    popular: true,
  },
  {
    id: 2,
    code: 'free-fire',
    name: 'Free Fire',
    category: 'Battle Royale',
    players: '320rb+',
    image: 'https://images.pexels.com/photos/442576/pexels-photo-442576.jpeg?auto=compress&cs=tinysrgb&w=400',
    color: 'from-orange-500 to-red-700',
    items: [
      { label: '70 Diamond', amountMinor: 11000 },
      { label: '140 Diamond', amountMinor: 21000 },
      { label: '355 Diamond', amountMinor: 52000 },
      { label: '720 Diamond', amountMinor: 101000 },
    ],
    popular: false,
  },
  {
    id: 3,
    code: 'pubg-mobile',
    name: 'PUBG Mobile',
    category: 'Battle Royale',
    players: '280rb+',
    image: 'https://images.pexels.com/photos/1293269/pexels-photo-1293269.jpeg?auto=compress&cs=tinysrgb&w=400',
    color: 'from-amber-500 to-slate-800',
    items: [
      { label: '60 UC', amountMinor: 15000 },
      { label: '120 UC', amountMinor: 30000 },
      { label: '325 UC', amountMinor: 75000 },
      { label: '660 UC', amountMinor: 145000 },
    ],
    popular: false,
  },
  {
    id: 4,
    code: 'genshin-impact',
    name: 'Genshin Impact',
    category: 'RPG',
    players: '190rb+',
    image: 'https://images.pexels.com/photos/3621104/pexels-photo-3621104.jpeg?auto=compress&cs=tinysrgb&w=400',
    color: 'from-teal-500 to-blue-800',
    items: [
      { label: '60 Genesis', amountMinor: 16000 },
      { label: '300 Genesis', amountMinor: 79000 },
      { label: '980 Genesis', amountMinor: 249000 },
      { label: '1980 Genesis', amountMinor: 479000 },
    ],
    popular: true,
  },
  {
    id: 5,
    code: 'honkai-star-rail',
    name: 'Honkai Star Rail',
    category: 'RPG',
    players: '120rb+',
    image: 'https://images.pexels.com/photos/7915357/pexels-photo-7915357.jpeg?auto=compress&cs=tinysrgb&w=400',
    color: 'from-violet-500 to-slate-800',
    items: [
      { label: '60 Oneiric', amountMinor: 16000 },
      { label: '300 Oneiric', amountMinor: 79000 },
      { label: '980 Oneiric', amountMinor: 249000 },
      { label: '1980 Oneiric', amountMinor: 479000 },
    ],
    popular: false,
  },
  {
    id: 6,
    code: 'clash-of-clans',
    name: 'Clash of Clans',
    category: 'Strategy',
    players: '95rb+',
    image: 'https://images.pexels.com/photos/4009402/pexels-photo-4009402.jpeg?auto=compress&cs=tinysrgb&w=400',
    color: 'from-green-600 to-emerald-900',
    items: [
      { label: '80 Gems', amountMinor: 15000 },
      { label: '500 Gems', amountMinor: 75000 },
      { label: '1200 Gems', amountMinor: 165000 },
      { label: '2500 Gems', amountMinor: 329000 },
    ],
    popular: false,
  },
];



export default function GameTopUp() {
  const [catalogProducts, setCatalogProducts] = useState<DisplayProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedProductKey, setSelectedProductKey] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [email, setEmail] = useState('');

  // Get customer ID label based on product category
  const getCustomerIdLabel = (category: string): string => {
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('pln') || lowerCategory.includes('listrik')) {
      return 'Nomor Pelanggan PLN';
    }
    if (lowerCategory.includes('pulsa') || lowerCategory.includes('paket') || lowerCategory.includes('data')) {
      return 'Nomor HP';
    }
    if (lowerCategory.includes('mobile legends') || lowerCategory.includes('mlbb')) {
      return 'User ID';
    }
    if (lowerCategory.includes('game') || lowerCategory.includes('free fire') || lowerCategory.includes('genshin')) {
      return 'User ID / Game ID';
    }
    if (lowerCategory.includes('voucher') || lowerCategory.includes('google play')) {
      return 'Email / User ID';
    }
    if (lowerCategory.includes('gopay') || lowerCategory.includes('ovo') || lowerCategory.includes('dana') || lowerCategory.includes('wallet')) {
      return 'Nomor HP / Email';
    }
    return 'ID Pelanggan / Nomor Tujuan';
  };

  // Check if Zone ID is needed (Mobile Legends only)
  const needsZoneId = (category: string): boolean => {
    const lowerCategory = category.toLowerCase();
    return lowerCategory.includes('mobile legends') || lowerCategory.includes('mlbb');
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<OrderResponse | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResponse | null>(null);

  // Midtrans Snap
  const { pay, isReady: isSnapReady } = useMidtransSnap();
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalogError(null);

      try {
        const response = await fetch(buildApiUrl('/api/catalog/products'));
        if (!response.ok) {
          throw new Error(await readApiError(response, 'Gagal memuat produk Digiflazz.'));
        }

        const body = (await response.json()) as CatalogResponse;
        const mappedProducts = Array.isArray(body.products) ? body.products.map(catalogProductToDisplay) : [];

        if (isMounted) {
          setCatalogProducts(mappedProducts);
          setSelectedProductKey((current) => current ?? mappedProducts[0]?.key ?? null);
        }
      } catch (error) {
        if (isMounted) {
          setCatalogError(error instanceof Error ? error.message : 'Produk Digiflazz belum dapat dimuat.');
        }
      } finally {
        if (isMounted) {
          setCatalogLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  const products = catalogProducts.length > 0 ? catalogProducts : fallbackProducts();
  const categories = useMemo(() => ['Semua', ...Array.from(new Set(products.map((product) => product.category))).sort()], [products]);
  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory = selectedCategory === 'Semua' || product.category === selectedCategory;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.code.toLowerCase().includes(normalizedSearch) ||
        product.provider.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [products, searchTerm, selectedCategory]);

  const selectedProduct = products.find((product) => product.key === selectedProductKey) ?? filteredProducts[0] ?? products[0];
  const selectedProductCategory = selectedProduct?.category || '';
  const customerIdLabel = getCustomerIdLabel(selectedProductCategory);
  const showZoneId = needsZoneId(selectedProductCategory);
  const paymentStatus = paymentResult === null ? orderResult?.status : `${orderResult?.status} / ${paymentResult.status}`;

  const submitCheckout = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setOrderResult(null);
    setPaymentResult(null);

    try {
      const orderResponse = await fetch(buildApiUrl('/api/orders'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_ref: `${customerId.trim()}:${zoneId.trim()}`,
          product_id: selectedProduct.productId ?? undefined,
          product_code: selectedProduct.code,
          provider: selectedProduct.provider,
          amount_minor: selectedProduct.amountMinor,
          currency: 'IDR',
          metadata: {
            source: 'web_checkout',
            product_name: selectedProduct.name,
            product_category: selectedProduct.category,
            sku_digiflazz: selectedProduct.code,
            customer_email: email.trim(),
            zone_id: zoneId.trim(),
          },
        }),
      });

      if (!orderResponse.ok) {
        throw new Error(await readApiError(orderResponse, 'Gagal membuat order. Coba lagi beberapa saat lagi.'));
      }

      const createdOrder = (await orderResponse.json()) as OrderResponse;
      setOrderResult(createdOrder);

      const paymentResponse = await fetch(buildApiUrl('/api/payments/midtrans/initialize'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: createdOrder.order_id,
          idempotency_key: `web-${createdOrder.order_id}-${Date.now()}`,
        }),
      });

      if (!paymentResponse.ok) {
        throw new Error(await readApiError(paymentResponse, 'Gagal menyiapkan pembayaran Midtrans.'));
      }

      const initializedPayment = (await paymentResponse.json()) as PaymentResponse;
      setPaymentResult(initializedPayment);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Checkout gagal. Coba ulangi transaksi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitCheckout();
  };

  const handlePay = (token: string) => {
    setIsPaying(true);
    setPaymentError(null);

    pay(token, {
      onSuccess: () => {
        setIsPaying(false);
        window.location.hash = `#/invoice/${orderResult?.invoice_code}`;
      },
      onPending: () => {
        setIsPaying(false);
        window.location.hash = `#/invoice/${orderResult?.invoice_code}`;
      },
      onError: (err) => {
        setIsPaying(false);
        setPaymentError('Pembayaran gagal. Silakan coba beberapa saat lagi.');
        console.error('Midtrans Error:', err);
      },
      onClose: () => {
        setIsPaying(false);
        setPaymentError('Pembayaran dibatalkan oleh pengguna.');
      }
    });
  };

  return (
    <section className="bg-slate-900 py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Gamepad2 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Katalog Produk Digiflazz</h2>
              <p className="text-slate-400 text-sm">Produk dari database, rapi per kategori</p>
            </div>
          </div>
          <button className="text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1">
            {catalogProducts.length > 0 ? `${catalogProducts.length} Produk Live` : 'Mode Demo'} →
          </button>
        </div>

        <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/10 backdrop-blur">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                data-testid="catalog-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari produk, SKU, provider..."
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/70 focus:ring-4 focus:ring-amber-300/10"
              />
            </div>
            <select
              data-testid="catalog-category-select"
              value={selectedCategory}
              onChange={(event) => {
                setSelectedCategory(event.target.value);
                setSelectedProductKey(null);
              }}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-amber-300/70 focus:ring-4 focus:ring-amber-300/10"
            >
              {categories.map((category) => (
                <option key={category} value={category} className="bg-slate-950 text-white">
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="rounded-full bg-white/10 px-3 py-1">{filteredProducts.length} produk tampil</span>
            <span className="rounded-full bg-white/10 px-3 py-1">{categories.length - 1} kategori</span>
            {catalogLoading && <span className="rounded-full bg-amber-300/20 px-3 py-1 text-amber-200">Memuat API...</span>}
            {catalogError && <span className="rounded-full bg-rose-400/20 px-3 py-1 text-rose-100">{catalogError} Mode demo aktif.</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredProducts.map((product, productIndex) => (
              <div
                key={product.key}
                data-testid={productIndex === 0 ? 'product-card-0' : undefined}
                className={`group relative rounded-2xl overflow-hidden border hover:shadow-xl hover:shadow-black/30 hover:-translate-y-1 transition-all duration-300 ${
                  selectedProduct?.key === product.key ? 'border-amber-300 shadow-xl shadow-amber-500/10' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${product.color} opacity-80`} />
                <img
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-25 transition-all duration-500 group-hover:scale-105 group-hover:opacity-35"
                />

                {product.popular && (
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-amber-400 text-slate-900 text-[10px] font-bold px-2 py-1 rounded-full">
                    <Zap size={10} />
                    POPULER
                  </div>
                )}

                <div className="relative z-10 p-5">
                  <div className="mb-4">
                    <span className="text-xs font-medium text-white/60 bg-white/10 px-2 py-0.5 rounded-full">
                      {product.category}
                    </span>
                    <h3 className="text-white font-bold text-lg mt-2">{product.name}</h3>
                    <p className="text-white/50 text-xs">{product.subtitle}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-white">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Harga jual</p>
                    <p className="mt-1 text-xl font-black">{formatRupiah(product.amountMinor)}</p>
                    <p className="mt-1 text-xs text-white/55">SKU: {product.code}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProductKey(product.key);
                    }}
                    className="mt-4 w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-semibold text-sm py-2.5 rounded-xl transition-all border border-white/20 hover:border-white/40"
                  >
                    Pilih Produk →
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-5 shadow-2xl shadow-black/20 border border-white/10 lg:sticky lg:top-24">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full tracking-wider uppercase">
                  Checkout
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-3">{selectedProduct.name}</h3>
                <p className="text-sm text-slate-500">{selectedProduct.category} · {formatRupiah(selectedProduct.amountMinor)}</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-slate-900 text-amber-300 flex items-center justify-center">
                <Zap size={20} />
              </div>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">{customerIdLabel}</span>
                <input
                  name="customer_id"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  required
                  placeholder={showZoneId ? "12345678" : "Masukkan nomor/ID"}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              {showZoneId && (
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Zone ID</span>
                  <input
                    name="zone_id"
                    value={zoneId}
                    onChange={(event) => setZoneId(event.target.value)}
                    required
                    placeholder="1234"
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Email (opsional)</span>
                <input
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nama@email.com"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                />
              </label>
            </div>

            <button
              data-testid="checkout-submit"
              type="submit"
              disabled={isSubmitting}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/25 transition hover:from-amber-300 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Membuat invoice...
                </>
              ) : (
                'Bayar & Dapatkan Invoice'
              )}
            </button>

            {errorMessage && (
              <div data-testid="checkout-error" className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
                <div className="flex items-start gap-2">
                  <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Checkout gagal</p>
                    <p className="mt-1">{errorMessage}</p>
                  </div>
                </div>
                <button
                  data-testid="checkout-retry"
                  type="button"
                  onClick={() => void submitCheckout()}
                  disabled={isSubmitting}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-70"
                >
                  <RefreshCw size={13} />
                  Coba Lagi
                </button>
              </div>
            )}

            {orderResult && (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={18} />
                  Invoice siap dibayar
                </div>
                <dl className="mt-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-emerald-700/80">Invoice</dt>
                    <dd data-testid="invoice-code" className="font-bold text-slate-900">{orderResult.invoice_code}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-emerald-700/80">Order ID</dt>
                    <dd data-testid="order-id" className="font-bold text-slate-900">{orderResult.order_id}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-emerald-700/80">Status</dt>
                    <dd data-testid="payment-status" className="font-bold text-slate-900">{paymentStatus}</dd>
                  </div>
                </dl>
                {paymentResult && (
                  <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <h3 className="text-sm font-bold text-slate-700 mb-2">Selesaikan Pembayaran</h3>
                    <p className="text-xs text-slate-500 mb-4">Silakan klik tombol di bawah untuk membayar menggunakan Midtrans Snap.</p>

                    {paymentError && (
                      <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-lg">
                        {paymentError}
                      </div>
                    )}

                    <button
                      onClick={() => handlePay(paymentResult.token)}
                      disabled={isPaying || !isSnapReady}
                      className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2"
                    >
                      {isPaying ? (
                        <>
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                          Memproses Pembayaran...
                        </>
                      ) : (
                        'Bayar Sekarang'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
