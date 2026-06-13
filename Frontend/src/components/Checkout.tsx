import React, { useState } from 'react';
import { ShoppingCart, Tag, AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';
import { useMidtransSnap } from '../hooks/useMidtransSnap';
import { buildApiUrl } from '../lib/api';

interface Product {
  id: string;
  name: string;
  category: string;
  provider: string;
  base_price_minor: number;
  reseller_price_minor?: number;
  image_url?: string;
  sku_digiflazz?: string;
}

interface VoucherValidation {
  valid: boolean;
  voucher?: {
    id: string;
    code: string;
    type: 'admin' | 'affiliate' | 'reseller';
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
  };
  calculation?: {
    original_amount: number;
    discount_amount: number;
    final_amount: number;
    effective_discount_percentage: number;
    profit_before?: number;
    profit_after?: number;
    actual_discount_from_profit_percentage?: number;
  };
  error?: string;
}

interface CustomerInfo {
  phone: string;
  email: string;
}

interface CheckoutProps {
  product: Product;
  userRole?: 'customer' | 'reseller' | 'admin';
  onClose: () => void;
  onCheckout: (data: any) => void;
}

const API_BASE = '/api';

export default function Checkout({ product, userRole = 'customer', onClose, onCheckout }: CheckoutProps) {
  const { pay, isReady: isSnapReady } = useMidtransSnap();
  const [isInitializingPayment, setIsInitializingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Single order - quantity always 1
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    phone: '',
    email: ''
  });
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherValidation, setVoucherValidation] = useState<VoucherValidation | null>(null);
  const [validatingVoucher, setValidatingVoucher] = useState(false);

  const isReseller = userRole === 'reseller' || userRole === 'admin';
  const displayPrice = isReseller && product.reseller_price_minor 
    ? product.reseller_price_minor 
    : product.base_price_minor;

  const updateCustomerInfo = (field: keyof CustomerInfo, value: string) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }));
  };

  const validateVoucher = async () => {
    if (!voucherCode.trim()) return;

    setValidatingVoucher(true);
    try {
      // Single item price (quantity always 1)
      const payload: any = {
        code: voucherCode.toUpperCase(),
        amount: displayPrice
      };

      if (isReseller && product.reseller_price_minor) {
        payload.base_price = product.base_price_minor;
        payload.reseller_price = product.reseller_price_minor;
      }

      const response = await fetch(`${API_BASE}/vouchers/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      setVoucherValidation(data);
    } catch (error) {
      console.error('Voucher validation error:', error);
      setVoucherValidation({
        valid: false,
        error: 'Failed to validate voucher'
      });
    } finally {
      setValidatingVoucher(false);
    }
  };

  const removeVoucher = () => {
    setVoucherCode('');
    setVoucherValidation(null);
  };

  const handleCheckout = async () => {
    // Validate phone number
    if (!customerInfo.phone.trim()) {
      alert('Please fill in phone number');
      return;
    }

    try {
      // Get logged in user token if available
      let authToken: string | null = null;
      try {
        const sessionStr = window.localStorage.getItem('bayarku.auth.session');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          if (session?.access_token) {
            authToken = session.access_token;
          }
        }
      } catch (e) {
        console.error('Failed to read session for checkout:', e);
      }

      // Build headers with authorization if logged in
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      // Calculate final amount after voucher (single item)
      const finalAmount = voucherValidation?.calculation?.final_amount || displayPrice;

      // Build payload for new modular /orders endpoint
      const payload = {
        product_id: product.id,
        product_code: product.sku_digiflazz || null,
        provider: product.provider,
        amount_minor: finalAmount,
        currency: 'IDR',
        customer_ref: customerInfo.phone || null,
        referral_code: null,
        discount_code: voucherValidation?.voucher?.code || null,
        metadata: {}
      };

      const response = await fetch(buildApiUrl('/orders'), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.order_id) {
        throw new Error(result.error || result.message || 'Failed to create order');
      }

      // Initialize payment with Midtrans via POST /api/payments/midtrans/initialize
      setIsInitializingPayment(true);
      setPaymentError(null);

      let payToken = '';
      try {
        const initResponse = await fetch(buildApiUrl('/payments/midtrans/initialize'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: result.order_id, idempotency_key: `web-${result.order_id}-${Date.now()}` })
        });

        const initResult = await initResponse.json();

        if (!initResponse.ok || !initResult.payment_id) {
          throw new Error(initResult.error || 'Failed to initialize payment');
        }

        payToken = initResult.token;
      } catch (payErr: any) {
        console.error('Payment initialization error:', payErr);
        setPaymentError(payErr.message || 'Gagal menginisialisasi pembayaran Midtrans');
        setIsInitializingPayment(false);
        return;
      }

      setIsInitializingPayment(false);

      const invoiceCode = result.invoice_code;

      pay(payToken, {
        onSuccess: (snapRes) => {
          window.location.hash = `#/invoice/${invoiceCode}`;
        },
        onPending: (snapRes) => {
          window.location.hash = `#/invoice/${invoiceCode}`;
        },
        onError: (snapErr) => {
          console.error('Midtrans Snap error:', snapErr);
          setPaymentError('Terjadi kesalahan saat memproses pembayaran.');
        },
        onClose: () => {
          window.location.hash = `#/invoice/${invoiceCode}`;
        }
      });

      // Pass order data to parent (single item)
      onCheckout({
        order: { id: result.order_id, invoice_code: result.invoice_code },
        summary: { total_amount: finalAmount, quantity: 1 }
      });

    } catch (error: any) {
      console.error('Checkout error:', error);
      alert(error.message || 'Failed to complete checkout');
    }
  };

  const formatRupiah = (amount: number) => {
    return `Rp ${(amount / 100).toLocaleString('id-ID')}`;
  };

  const finalAmount = voucherValidation?.calculation?.final_amount || displayPrice;
  const discountAmount = voucherValidation?.calculation?.discount_amount || 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-500/10 rounded-xl">
              <ShoppingCart className="text-cyan-400" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Checkout</h2>
              <p className="text-slate-400 text-sm">Complete your purchase</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="text-slate-400" size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Product Info with Quantity */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex gap-4">
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-20 h-20 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="font-bold text-white">{product.name}</h3>
                <p className="text-sm text-slate-400">{product.provider}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-1 bg-cyan-500/10 text-cyan-400 text-xs font-bold rounded">
                    {product.category}
                  </span>
                  {isReseller && (
                    <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs font-bold rounded">
                      Reseller Price
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Price</p>
                <p className="text-xl font-black text-white">{formatRupiah(displayPrice)}</p>
                {isReseller && product.reseller_price_minor && (
                  <p className="text-xs text-slate-500 mt-1">
                    Base: {formatRupiah(product.base_price_minor)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Customer Info - Single Form */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-white">Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={customerInfo.phone}
                  onChange={(e) => updateCustomerInfo('phone', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  placeholder="08123456789"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={customerInfo.email}
                  onChange={(e) => updateCustomerInfo('email', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  placeholder="email@example.com"
                />
              </div>
            </div>
          </div>

          {/* Voucher Input */}
          <div className="space-y-4">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Tag size={20} className="text-cyan-400" />
              Promo Code
            </h3>
            
            {!voucherValidation?.valid ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && validateVoucher()}
                  className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 uppercase"
                  placeholder="Enter promo code"
                  disabled={validatingVoucher}
                />
                <button
                  onClick={validateVoucher}
                  disabled={validatingVoucher || !voucherCode.trim()}
                  className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition flex items-center gap-2"
                >
                  {validatingVoucher ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Checking...
                    </>
                  ) : (
                    'Apply'
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-green-400 mt-1" size={20} />
                    <div>
                      <p className="font-bold text-green-400">Voucher Applied!</p>
                      <p className="text-sm text-slate-300 mt-1">
                        Code: <span className="font-mono font-bold">{voucherCode}</span>
                      </p>
                      <p className="text-sm text-slate-300">
                        Discount: {formatRupiah(discountAmount)} 
                        <span className="text-green-400 font-bold ml-1">
                          ({voucherValidation.calculation?.effective_discount_percentage}%)
                        </span>
                      </p>
                      
                      {/* Admin/Reseller Note */}
                      {(userRole === 'admin' || userRole === 'reseller') && 
                       voucherValidation.voucher?.type === 'reseller' && 
                       voucherValidation.calculation?.actual_discount_from_profit_percentage && (
                        <div className="mt-2 p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                          <p className="text-xs text-purple-300">
                            <span className="font-bold">Note for {userRole}:</span> Customer sees {voucherValidation.calculation.effective_discount_percentage}% discount, 
                            but this is {voucherValidation.calculation.actual_discount_from_profit_percentage}% from your profit 
                            ({formatRupiah(voucherValidation.calculation.profit_before || 0)} → {formatRupiah(voucherValidation.calculation.profit_after || 0)})
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={removeVoucher}
                    className="p-2 hover:bg-slate-800 rounded-lg transition"
                  >
                    <X className="text-slate-400" size={16} />
                  </button>
                </div>
              </div>
            )}

            {voucherValidation && !voucherValidation.valid && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="text-red-400 mt-1" size={20} />
                <div>
                  <p className="font-bold text-red-400">Invalid Voucher</p>
                  <p className="text-sm text-slate-300 mt-1">
                    {voucherValidation.error || 'This voucher code is not valid'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Price Summary */}
          {paymentError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="text-red-400 mt-1" size={20} />
              <div>
                <p className="font-bold text-red-400">Payment Error</p>
                <p className="text-sm text-slate-300 mt-1">{paymentError}</p>
              </div>
            </div>
          )}

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-3">
            <h3 className="font-bold text-white mb-4">Payment Summary</h3>
            
            <div className="flex justify-between text-slate-300">
              <span>Price</span>
              <span className="font-bold">{formatRupiah(displayPrice)}</span>
            </div>

            {voucherValidation?.valid && discountAmount > 0 && (
              <div className="flex justify-between text-green-400">
                <span>Discount ({voucherValidation.calculation?.effective_discount_percentage}%)</span>
                <span className="font-bold">-{formatRupiah(discountAmount)}</span>
              </div>
            )}

            <div className="border-t border-slate-700 pt-3 mt-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-white">Total</span>
                <span className="text-2xl font-black text-cyan-400">
                  {formatRupiah(finalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={!customerInfo.phone.trim() || isInitializingPayment}
            className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-black rounded-xl transition text-lg flex items-center justify-center gap-2"
          >
            {isInitializingPayment ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Initializing Payment...
              </>
            ) : (
              'Complete Purchase'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
