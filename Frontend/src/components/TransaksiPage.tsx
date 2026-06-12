import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, ArrowRight, ChevronDown, ChevronUp, Loader2, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { buildApiUrl } from '../lib/api';
import { getAuthToken } from '../lib/auth';

interface OrderItem {
  id: string;
  order_number: string;
  customer_ref: string;
  product_code: string;
  provider: string;
  amount_minor: number;
  currency: string;
  status: string;
  created_at: string;
  metadata?: any;
}

interface TransaksiPageProps {
  onNavigate: (path: string) => void;
}

export default function TransaksiPage({ onNavigate }: TransaksiPageProps) {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const token = getAuthToken();

  const fetchOrders = async () => {
    if (!token) {
      setError('Anda harus login terlebih dahulu.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(buildApiUrl('/orders'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Gagal mengambil riwayat transaksi.');
      }

      const data = await response.json();
      if (data.orders) {
        setOrders(data.orders);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token]);

  const toggleExpand = (id: string) => {
    if (expandedOrderId === id) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(id);
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClass = "px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase ";
    switch (status.toLowerCase()) {
      case 'success':
        return <span className={baseClass + "bg-emerald-100 text-emerald-800 border border-emerald-200"}>Sukses</span>;
      case 'created':
      case 'pending_payment':
      case 'fulfillment_pending':
        return <span className={baseClass + "bg-amber-100 text-amber-800 border border-amber-200 animate-pulse"}>Diproses</span>;
      case 'failed':
      case 'expired':
        return <span className={baseClass + "bg-rose-100 text-rose-800 border border-rose-200"}>Gagal</span>;
      default:
        return <span className={baseClass + "bg-slate-100 text-slate-800"}>{status}</span>;
    }
  };

  const formatPrice = (amountMinor: number) => {
    const amount = amountMinor / 100;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredOrders = orders.filter(order => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'sukses') return order.status.toLowerCase() === 'success';
    if (filterStatus === 'pending') {
      return ['created', 'pending_payment', 'fulfillment_pending'].includes(order.status.toLowerCase());
    }
    if (filterStatus === 'gagal') {
      return ['failed', 'expired'].includes(order.status.toLowerCase());
    }
    return true;
  });

  return (
    <div className="min-h-screen pt-24 pb-12 bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Breadcrumb / Back Button */}
        <button
          onClick={() => onNavigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Kembali ke Dashboard
        </button>

        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Riwayat Transaksi</h1>
            <p className="text-slate-500 text-sm mt-1">Pantau semua status pengisian pulsa, paket data, dan e-wallet Anda</p>
          </div>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all shadow-sm flex items-center justify-center disabled:opacity-50"
            title="Refresh Data"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
          {['all', 'sukses', 'pending', 'gagal'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                filterStatus === status
                  ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {status.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Orders List / Content */}
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Loader2 size={32} className="animate-spin text-amber-500 mb-4" />
            <p className="text-slate-500 text-sm">Sedang memuat riwayat transaksi...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 flex items-start gap-3 shadow-sm">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Gagal memuat data</p>
              <p className="text-sm mt-0.5">{error}</p>
              <button
                onClick={fetchOrders}
                className="mt-3 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
              <CreditCard size={28} />
            </div>
            <p className="text-slate-800 font-bold text-lg">Belum ada transaksi</p>
            <p className="text-slate-500 text-sm mt-1 max-w-xs">
              Transaksi pengisian pulsa atau topup e-wallet Anda akan muncul di sini.
            </p>
            <button
              onClick={() => onNavigate('/')}
              className="mt-6 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-lg"
            >
              Mulai Transaksi Pertama
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              return (
                <div 
                  key={order.id}
                  className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  <div 
                    onClick={() => toggleExpand(order.id)}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white flex-shrink-0">
                        <CreditCard size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 tracking-tight">{order.order_number}</span>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                          <Calendar size={12} />
                          <span>{formatDate(order.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 border-t border-slate-50 sm:border-0 pt-3 sm:pt-0">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Total Pembayaran</p>
                        <p className="text-base font-extrabold text-slate-900 mt-0.5">{formatPrice(order.amount_minor)}</p>
                      </div>
                      <div className="text-slate-400">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-3 border-t border-slate-50 bg-slate-50/30 space-y-4 text-sm text-slate-600">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Detail Layanan</p>
                          <p className="font-bold text-slate-800 mt-1">{order.provider} - {order.product_code}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Nomor Tujuan: {order.customer_ref}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Metode Pembayaran</p>
                          <p className="font-bold text-slate-800 mt-1">Saldo Akun (Deposit)</p>
                          <p className="text-xs text-slate-500 mt-0.5">ID Order: {order.id}</p>
                        </div>
                      </div>

                      {/* Display SN / Voucher / Token Code if transaction is success */}
                      {order.status.toLowerCase() === 'success' && (
                        <div className="p-4 bg-emerald-50/80 border border-emerald-100 rounded-xl">
                          <p className="text-xs text-emerald-800 font-bold uppercase tracking-wider">Nomor Serial (SN) / Kode Token</p>
                          <p className="text-lg font-mono font-bold text-emerald-950 mt-1.5 select-all">
                            {order.metadata?.serial_number || order.metadata?.sn || 'Transaksi Sukses (SN sedang diperbarui)'}
                          </p>
                        </div>
                      )}

                      {/* Status Note or Helper link */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100/50 text-xs text-slate-400">
                        <span>Butuh bantuan terkait order ini? Hubungi CS</span>
                        <a 
                          href={`/invoice/${encodeURIComponent(order.order_number)}`}
                          onClick={(e) => {
                            e.preventDefault();
                            onNavigate(`/invoice/${encodeURIComponent(order.order_number)}`);
                          }}
                          className="font-bold text-amber-600 hover:text-amber-700 flex items-center gap-0.5 transition-colors"
                        >
                          Lihat Invoice
                          <ArrowRight size={12} />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
