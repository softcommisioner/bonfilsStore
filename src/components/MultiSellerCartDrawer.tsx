import React, { useEffect, useState } from 'react';
import { X, ShoppingBag, Trash2, Plus, Minus, ArrowRight, Store, CheckCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { compressImageFile } from '../services/images';
import {
  DEFAULT_USD_TO_RWF_RATE, formatRwf, normalizeUsdToRwfRate, whatsappLink,
  type SellerPaymentInfo,
} from '../types';

interface MultiSellerCartDrawerProps {
  onNavigate: (route: string) => void;
}

function bankSummary(payment: SellerPaymentInfo): string {
  return [
    payment.bankName,
    payment.bankAccountName,
    payment.bankAccountNumber ? `A/C ${payment.bankAccountNumber}` : '',
  ].filter(Boolean).join(' · ');
}

function paymentWhatsappMessage(order: any, sellerName: string): string {
  const amount = Number(order?.total || 0);
  const rate = normalizeUsdToRwfRate(order?.usdToRwfRate);
  const method = String(order?.paymentMethod || '').replace(/_/g, ' ').toUpperCase();
  return `Hi ${sellerName}, I have paid for Bonfils Store order ${order?.orderNumber || ''} ($${amount.toFixed(2)} / ${formatRwf(amount, rate)}) via ${method}. I have the payment screenshot ready to share — please confirm receipt.`;
}

export const MultiSellerCartDrawer: React.FC<MultiSellerCartDrawerProps> = ({ onNavigate }) => {
  const { 
    isCartOpen, setIsCartOpen, items, updateQuantity, 
    removeItem, subtotal, shippingFee, total, groupedBySeller, clearCart 
  } = useCart();
  const { user, isAuthenticated } = useAuth();

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);
  const [usdToRwfRate, setUsdToRwfRate] = useState(DEFAULT_USD_TO_RWF_RATE);
  const [sellerPayments, setSellerPayments] = useState<SellerPaymentInfo[]>([]);

  // Checkout address state
  const [fullName, setFullName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [city, setCity] = useState(user?.city || 'Kigali');
  const [street, setStreet] = useState('KG 9 Ave, Nyarutarama');
  const [paymentMethod, setPaymentMethod] = useState<'momo_pay' | 'airtel_money' | 'bank_transfer'>('momo_pay');
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentProofs, setPaymentProofs] = useState<Record<string, string>>({});
  const [paymentProofErrors, setPaymentProofErrors] = useState<Record<string, string>>({});
  const [processingProofs, setProcessingProofs] = useState<Record<string, boolean>>({});

  const sellerKey = groupedBySeller.map(group => group.businessId).join('|');

  useEffect(() => {
    if (!isCartOpen) return;
    let cancelled = false;
    api.getPublicSettings()
      .then(({ settings }) => {
        if (!cancelled) setUsdToRwfRate(normalizeUsdToRwfRate(settings.usdToRwfRate));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [isCartOpen]);

  useEffect(() => {
    if (!isCheckingOut || !sellerKey) return;
    let cancelled = false;
    const ids = Array.from(new Set(sellerKey.split('|').filter(Boolean)));
    Promise.all(ids.map(async (businessId) => {
      const group = groupedBySeller.find(item => item.businessId === businessId);
      const fallbackName = group?.sellerName || 'Seller';
      try {
        const { business } = await api.getSeller(businessId);
        return {
          businessId,
          sellerName: business.name || fallbackName,
          momoPayCode: business.momoPayCode || '',
          airtelMoneyCode: business.airtelMoneyCode || '',
          bankName: business.bankName || '',
          bankAccountName: business.bankAccountName || '',
          bankAccountNumber: business.bankAccountNumber || '',
          whatsappNumber: business.whatsappNumber || business.phone || '',
        };
      } catch {
        return {
          businessId,
          sellerName: fallbackName,
          momoPayCode: '',
          airtelMoneyCode: '',
          bankName: '',
          bankAccountName: '',
          bankAccountNumber: '',
          whatsappNumber: '',
        };
      }
    })).then(list => {
      if (!cancelled) setSellerPayments(list);
    });
    return () => { cancelled = true; };
  }, [isCheckingOut, sellerKey]);

  if (!isCartOpen) return null;

  const successRate = normalizeUsdToRwfRate(orderSuccess?.usdToRwfRate ?? usdToRwfRate);
  const successPayments: SellerPaymentInfo[] = Array.isArray(orderSuccess?.paymentCodes)
    ? orderSuccess.paymentCodes
    : sellerPayments;

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setIsCartOpen(false);
      onNavigate('/login');
      return;
    }

    if (!fullName || !phone || !street || !city) {
      setErrorMessage('Please fill in complete delivery details.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const orderPayload = {
        items: items.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        shippingAddress: {
          fullName,
          phone,
          street,
          city,
          country: user?.country || 'Rwanda',
        },
        paymentMethod,
      };

      const res = await api.createOrder(orderPayload);
      clearCart();
      setPaymentProofs({});
      setPaymentProofErrors({});
      setOrderSuccess(res.order);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to place order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentProofChange = async (businessId: string, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPaymentProofErrors(previous => ({
        ...previous,
        [businessId]: 'Please choose an image file (JPG, PNG, or screenshot).',
      }));
      return;
    }
    setProcessingProofs(previous => ({ ...previous, [businessId]: true }));
    setPaymentProofErrors(previous => ({ ...previous, [businessId]: '' }));
    try {
      const preview = await compressImageFile(file);
      setPaymentProofs(previous => ({ ...previous, [businessId]: preview }));
    } catch (err: any) {
      setPaymentProofErrors(previous => ({
        ...previous,
        [businessId]: err.message || 'Could not read that image. Please try another file.',
      }));
    } finally {
      setProcessingProofs(previous => ({ ...previous, [businessId]: false }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#F7F7F7]">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#FF6A00]" />
            <h3 className="text-base font-bold text-[#222222]">
              {orderSuccess ? 'Order Placed' : isCheckingOut ? 'Express Checkout' : 'Multi-Seller Cart'}
            </h3>
          </div>
          <button
            onClick={() => {
              setIsCartOpen(false);
              setIsCheckingOut(false);
              setOrderSuccess(null);
            }}
            className="p-1.5 text-[#666666] hover:text-[#222222] rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {orderSuccess ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-50 text-[#22A06B] rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-bold text-[#222222]">Order Placed</h4>
              <p className="text-xs text-[#666666] leading-relaxed">
                Order <strong>{orderSuccess.orderNumber}</strong> has been routed to{' '}
                <strong>{orderSuccess.items.length} seller(s)</strong>. Confirmation email has been sent.
              </p>

              <div className="bg-[#F7F7F7] p-3 rounded-lg text-left text-xs space-y-1 my-4">
                <div className="flex justify-between">
                  <span className="text-[#666666]">Order Total (USD):</span>
                  <span className="font-bold text-[#222222] tabular-nums">${orderSuccess.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666666]">Order Total (RWF):</span>
                  <span className="font-bold text-[#FF6A00] tabular-nums">
                    {formatRwf(orderSuccess.total, successRate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666666]">Items count:</span>
                  <span className="font-bold text-[#222222]">{orderSuccess.items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666666]">Delivery to:</span>
                  <span className="font-medium text-[#222222]">{orderSuccess.shippingAddress.city}</span>
                </div>
              </div>

              <div className="rounded-lg border border-[#FF6A00]/25 bg-[#FFF3E8] p-3 text-left text-[11px] text-[#555555] space-y-2">
                <p className="font-bold text-[#222222]">Complete your payment</p>
                <p>
                  Pay the seller below, upload your payment screenshot, then send{' '}
                  <strong>&quot;Hi&quot;</strong> on WhatsApp. Attach the previewed screenshot in the chat
                  so the seller can confirm your payment.
                </p>
                {successPayments.map(payment => {
                  const proof = paymentProofs[payment.businessId];
                  const proofError = paymentProofErrors[payment.businessId];
                  const isProcessing = Boolean(processingProofs[payment.businessId]);
                  const link = proof && payment.whatsappNumber
                    ? whatsappLink(payment.whatsappNumber, paymentWhatsappMessage(orderSuccess, payment.sellerName))
                    : '';
                  return (
                    <div key={payment.businessId} className="border-t border-[#FF6A00]/20 pt-2">
                      <div className="font-semibold text-[#222222]">{payment.sellerName}</div>
                      <div className="mt-1 space-y-0.5">
                        <div>Mobile Money (MoMo Pay): {payment.momoPayCode || 'Not set'}</div>
                        <div>Airtel Money USSD / code: {payment.airtelMoneyCode || 'Not set'}</div>
                        <div>Bank Account: {bankSummary(payment) || 'Not set'}</div>
                      </div>
                      <div className="mt-2 space-y-2">
                        <label className="block font-semibold text-[#222222]">
                          Payment screenshot (required)
                          <input
                            type="file"
                            accept="image/*"
                            onChange={event => {
                              void handlePaymentProofChange(payment.businessId, event.target.files?.[0]);
                              event.target.value = '';
                            }}
                            className="mt-1 block w-full text-[10px] text-[#555555] file:mr-2 file:rounded file:border-0 file:bg-[#FF6A00] file:px-2 file:py-1 file:text-[10px] file:font-bold file:text-white"
                          />
                        </label>
                        {isProcessing && (
                          <p className="text-[10px] text-[#666666]">Reading image...</p>
                        )}
                        {proofError && (
                          <p className="text-[10px] text-[#D92D20]">{proofError}</p>
                        )}
                        {!proof && !proofError && !isProcessing && (
                          <p className="text-[10px] text-[#B54708]">
                            Upload an image screenshot to unlock WhatsApp for this seller.
                          </p>
                        )}
                        {proof && (
                          <div className="flex items-start gap-2">
                            <img
                              src={proof}
                              alt={`Payment screenshot for ${payment.sellerName}`}
                              className="h-20 w-20 rounded border border-[#E5E5E5] object-cover"
                            />
                            <span className="text-[10px] font-semibold text-[#22A06B]">
                              Screenshot ready — attach it in the WhatsApp chat.
                            </span>
                          </div>
                        )}
                        {payment.whatsappNumber && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span>WhatsApp: {payment.whatsappNumber}</span>
                            {link ? (
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-[#FF6A00] hover:underline"
                              >
                                Send &quot;Hi&quot; on WhatsApp
                              </a>
                            ) : (
                              <button
                                type="button"
                                disabled
                                aria-disabled
                                className="cursor-not-allowed font-bold text-[#999999]"
                              >
                                Send &quot;Hi&quot; on WhatsApp
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 space-y-2">
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    setOrderSuccess(null);
                    onNavigate('/account?tab=orders');
                  }}
                  className="w-full py-2.5 bg-[#FF6A00] text-white text-xs font-bold rounded-lg hover:bg-[#FF8A00] transition-colors cursor-pointer"
                >
                  View My Orders
                </button>
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    setOrderSuccess(null);
                    onNavigate('/products');
                  }}
                  className="w-full py-2 bg-transparent text-xs font-semibold text-[#666666] hover:text-[#222222] cursor-pointer"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          ) : isCheckingOut ? (
            /* Checkout Form */
            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-[#D92D20] text-xs rounded-lg">
                  {errorMessage}
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-[#222222] uppercase tracking-wide mb-2">Delivery Address</h4>
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#555555] mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-md focus:border-[#FF6A00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#555555] mb-1">Phone Number</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+250 788 000 000"
                      className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-md focus:border-[#FF6A00] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#555555] mb-1">City</label>
                      <input
                        type="text"
                        required
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-md focus:border-[#FF6A00] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#555555] mb-1">Street Address</label>
                      <input
                        type="text"
                        required
                        value={street}
                        onChange={e => setStreet(e.target.value)}
                        placeholder="Street / House No."
                        className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-md focus:border-[#FF6A00] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-[#222222] uppercase tracking-wide mb-2">Payment Method</h4>
                <div className="space-y-1.5">
                  <label className={`flex items-center justify-between p-2.5 border rounded-lg cursor-pointer text-xs ${paymentMethod === 'momo_pay' ? 'border-[#FF6A00] bg-[#FFF3E8]' : 'border-[#E5E5E5]'}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === 'momo_pay'}
                        onChange={() => setPaymentMethod('momo_pay')}
                        className="text-[#FF6A00] focus:ring-[#FF6A00]"
                      />
                      <span className="font-semibold text-[#222222]">Mobile Money (MoMo Pay code)</span>
                    </div>
                    <span className="text-[10px] text-[#666666]">USSD / pay code</span>
                  </label>

                  <label className={`flex items-center justify-between p-2.5 border rounded-lg cursor-pointer text-xs ${paymentMethod === 'airtel_money' ? 'border-[#FF6A00] bg-[#FFF3E8]' : 'border-[#E5E5E5]'}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === 'airtel_money'}
                        onChange={() => setPaymentMethod('airtel_money')}
                        className="text-[#FF6A00] focus:ring-[#FF6A00]"
                      />
                      <span className="font-semibold text-[#222222]">Airtel Money USSD / code</span>
                    </div>
                    <span className="text-[10px] text-[#666666]">USSD / pay code</span>
                  </label>

                  <label className={`flex items-center justify-between p-2.5 border rounded-lg cursor-pointer text-xs ${paymentMethod === 'bank_transfer' ? 'border-[#FF6A00] bg-[#FFF3E8]' : 'border-[#E5E5E5]'}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === 'bank_transfer'}
                        onChange={() => setPaymentMethod('bank_transfer')}
                        className="text-[#FF6A00] focus:ring-[#FF6A00]"
                      />
                      <span className="font-semibold text-[#222222]">Bank Account number / details</span>
                    </div>
                    <span className="text-[10px] text-[#666666]">Bank transfer</span>
                  </label>
                </div>

                <div className="mt-2 space-y-2">
                  {sellerPayments.length > 0 ? sellerPayments.map(payment => (
                    <div key={payment.businessId} className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-2.5 text-[11px] text-[#555555]">
                      <div className="font-bold text-[#222222]">{payment.sellerName}</div>
                      <div className="mt-1">Mobile Money (MoMo Pay): <strong className="text-[#222222]">{payment.momoPayCode || 'Not set'}</strong></div>
                      <div>Airtel Money USSD / code: <strong className="text-[#222222]">{payment.airtelMoneyCode || 'Not set'}</strong></div>
                      <div>Bank Account: <strong className="text-[#222222]">{bankSummary(payment) || 'Not set'}</strong></div>
                    </div>
                  )) : (
                    <p className="text-[11px] text-[#888888]">Payment details are not available yet — contact support before paying.</p>
                  )}
                </div>
              </div>

              {/* Local currency and seller payment codes */}
              <div className="p-3 rounded-lg text-xs space-y-2 border border-[#FF6A00]/25 bg-[#FFF3E8]">
                <div className="flex justify-between">
                  <span className="text-[#555555]">Exchange rate</span>
                  <span className="font-semibold text-[#222222] tabular-nums">
                    1 USD = {usdToRwfRate.toLocaleString('en-US')} RWF
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555555]">You will pay</span>
                  <span className="font-bold text-[#FF6A00] tabular-nums">{formatRwf(total, usdToRwfRate)}</span>
                </div>
              </div>

              {/* Multi-Seller Package Summary */}
              <div className="p-3 bg-[#F7F7F7] rounded-lg text-xs space-y-1.5 border border-[#E5E5E5]">
                <div className="font-bold text-[#222222] mb-1">Order Summary ({groupedBySeller.length} Seller Packages)</div>
                {groupedBySeller.map(group => (
                  <div key={group.businessId} className="flex justify-between text-[#666666] text-[11px]">
                    <span>{group.sellerName} ({group.items.length} items):</span>
                    <span className="tabular-nums font-medium text-[#222222]">
                      ${group.sellerSubtotal.toFixed(2)} · {formatRwf(group.sellerSubtotal, usdToRwfRate)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-[#E5E5E5] pt-1.5 flex justify-between font-bold text-sm text-[#FF6A00]">
                  <span>Total Amount:</span>
                  <span className="tabular-nums text-right">
                    ${total.toFixed(2)}
                    <span className="block text-[11px]">{formatRwf(total, usdToRwfRate)}</span>
                  </span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCheckingOut(false)}
                  className="w-1/3 py-2.5 border border-[#E5E5E5] rounded-lg text-xs font-semibold text-[#666666] hover:bg-[#F7F7F7] cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-[#FF6A00] text-white text-xs font-bold rounded-lg hover:bg-[#FF8A00] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? 'Processing...' : `Place Order · ${formatRwf(total, usdToRwfRate)}`}
                </button>
              </div>
            </form>
          ) : items.length === 0 ? (
            /* Empty Cart */
            <div className="text-center py-16 space-y-3">
              <ShoppingBag className="w-12 h-12 mx-auto text-[#CCCCCC]" />
              <p className="text-sm font-semibold text-[#222222]">Your shopping cart is empty</p>
              <p className="text-xs text-[#888888]">Browse verified sellers or request custom products from China.</p>
              <button
                onClick={() => {
                  setIsCartOpen(false);
                  onNavigate('/products');
                }}
                className="mt-4 px-4 py-2 bg-[#FF6A00] text-white text-xs font-bold rounded-lg hover:bg-[#FF8A00] cursor-pointer inline-flex items-center gap-1"
              >
                <span>Browse Products</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            /* Items Grouped by Seller (Requirement 14) */
            <div className="space-y-6">
              <div className="text-xs text-[#666666] bg-[#FFF3E8] p-2.5 rounded-lg border border-[#FF6A00]/20">
                Items are grouped by individual seller for streamlined multi-vendor fulfillment.
              </div>

              {groupedBySeller.map(group => (
                <div key={group.businessId} className="border border-[#E5E5E5] rounded-lg overflow-hidden bg-white">
                  {/* Seller Header */}
                  <div className="bg-[#FAFAFA] px-3.5 py-2 border-b border-[#E5E5E5] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Store className="w-3.5 h-3.5 text-[#FF6A00]" />
                      <span className="text-xs font-bold text-[#222222]">{group.sellerName}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-[#666666] tabular-nums">
                      ${group.sellerSubtotal.toFixed(2)} · {formatRwf(group.sellerSubtotal, usdToRwfRate)}
                    </span>
                  </div>

                  {/* Seller Items */}
                  <div className="divide-y divide-[#F0F0F0]">
                    {group.items.map(item => (
                      <div key={item.product.id} className="p-3 flex gap-3 items-center">
                        <img
                          src={item.product.images[0] || '/src/assets/images/product_cctv_camera_1790334796559.jpg'}
                          alt={item.product.title}
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 object-cover rounded-md border border-[#EEEEEE] shrink-0 bg-[#F9F9F8]"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-semibold text-[#222222] line-clamp-1">
                            {item.product.title}
                          </h4>
                          <div className="text-xs font-bold text-[#FF6A00] tabular-nums mt-0.5">
                            ${item.product.price.toFixed(2)}{' '}
                            <span className="text-[10px] font-medium text-[#888888]">
                              ({formatRwf(item.product.price, usdToRwfRate)})
                            </span>
                          </div>
                          
                          {/* Stepper & Remove */}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center border border-[#E5E5E5] rounded-md overflow-hidden bg-[#FAFAFA]">
                              <button
                                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                className="p-1 hover:bg-[#EEEEEE] text-[#555555] cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-2.5 text-xs font-medium tabular-nums text-[#222222]">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                className="p-1 hover:bg-[#EEEEEE] text-[#555555] cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <button
                              onClick={() => removeItem(item.product.id)}
                              className="text-xs text-[#888888] hover:text-[#D92D20] p-1 cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Totals & Checkout Button */}
        {!orderSuccess && items.length > 0 && !isCheckingOut && (
          <div className="p-4 border-t border-[#E5E5E5] bg-[#FAFAFA] space-y-3">
            <div className="space-y-1 text-xs text-[#666666]">
              <div className="flex justify-between">
                <span>Items Subtotal:</span>
                <span className="tabular-nums font-semibold text-[#222222]">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Local Shipping:</span>
                <span className="tabular-nums text-[#222222]">{shippingFee === 0 ? 'FREE' : `$${shippingFee.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[#E5E5E5] text-sm font-bold text-[#222222]">
                <span>Order Total:</span>
                <span className="text-[#FF6A00] tabular-nums text-right">
                  ${total.toFixed(2)}
                  <span className="block text-[11px]">{formatRwf(total, usdToRwfRate)}</span>
                </span>
              </div>
              <p className="pt-1 text-[10px] text-[#888888]">
                Converted at 1 USD = {usdToRwfRate.toLocaleString('en-US')} RWF. Sellers share payment codes before you confirm.
              </p>
            </div>

            <button
              onClick={() => {
                if (!isAuthenticated) {
                  setIsCartOpen(false);
                  onNavigate('/login');
                } else {
                  setIsCheckingOut(true);
                }
              }}
              className="w-full py-3 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <span>{isAuthenticated ? 'Proceed to Multi-Seller Checkout' : 'Sign In to Checkout'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
