import React, { useState } from 'react';
import { X, ShoppingBag, Trash2, Plus, Minus, ArrowRight, Store, CheckCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface MultiSellerCartDrawerProps {
  onNavigate: (route: string) => void;
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

  // Checkout address state
  const [fullName, setFullName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [city, setCity] = useState(user?.city || 'Kigali');
  const [street, setStreet] = useState('KG 9 Ave, Nyarutarama');
  const [paymentMethod, setPaymentMethod] = useState<'mobile_money' | 'card' | 'cash_on_delivery'>('mobile_money');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isCartOpen) return null;

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
      setOrderSuccess(res.order);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to place order.');
    } finally {
      setIsSubmitting(false);
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
              <h4 className="text-lg font-bold text-[#222222]">Payment Successful!</h4>
              <p className="text-xs text-[#666666] leading-relaxed">
                Order <strong>{orderSuccess.orderNumber}</strong> has been routed to <strong>{orderSuccess.items.length} seller(s)</strong>. Confirmation email has been sent.
              </p>

              <div className="bg-[#F7F7F7] p-3 rounded-lg text-left text-xs space-y-1 my-4">
                <div className="flex justify-between">
                  <span className="text-[#666666]">Total Paid:</span>
                  <span className="font-bold text-[#222222] tabular-nums">${orderSuccess.total.toFixed(2)}</span>
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
                  <label className={`flex items-center justify-between p-2.5 border rounded-lg cursor-pointer text-xs ${paymentMethod === 'mobile_money' ? 'border-[#FF6A00] bg-[#FFF3E8]' : 'border-[#E5E5E5]'}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === 'mobile_money'}
                        onChange={() => setPaymentMethod('mobile_money')}
                        className="text-[#FF6A00] focus:ring-[#FF6A00]"
                      />
                      <span className="font-semibold text-[#222222]">MTN MoMo / Airtel Money</span>
                    </div>
                    <span className="text-[10px] text-[#666666]">Instant</span>
                  </label>

                  <label className={`flex items-center justify-between p-2.5 border rounded-lg cursor-pointer text-xs ${paymentMethod === 'card' ? 'border-[#FF6A00] bg-[#FFF3E8]' : 'border-[#E5E5E5]'}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === 'card'}
                        onChange={() => setPaymentMethod('card')}
                        className="text-[#FF6A00] focus:ring-[#FF6A00]"
                      />
                      <span className="font-semibold text-[#222222]">Visa / Mastercard</span>
                    </div>
                    <span className="text-[10px] text-[#666666]">Credit/Debit</span>
                  </label>

                  <label className={`flex items-center justify-between p-2.5 border rounded-lg cursor-pointer text-xs ${paymentMethod === 'cash_on_delivery' ? 'border-[#FF6A00] bg-[#FFF3E8]' : 'border-[#E5E5E5]'}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === 'cash_on_delivery'}
                        onChange={() => setPaymentMethod('cash_on_delivery')}
                        className="text-[#FF6A00] focus:ring-[#FF6A00]"
                      />
                      <span className="font-semibold text-[#222222]">Cash on Delivery</span>
                    </div>
                    <span className="text-[10px] text-[#666666]">Pay on arrival</span>
                  </label>
                </div>
              </div>

              {/* Multi-Seller Package Summary */}
              <div className="p-3 bg-[#F7F7F7] rounded-lg text-xs space-y-1.5 border border-[#E5E5E5]">
                <div className="font-bold text-[#222222] mb-1">Order Summary ({groupedBySeller.length} Seller Packages)</div>
                {groupedBySeller.map(group => (
                  <div key={group.businessId} className="flex justify-between text-[#666666] text-[11px]">
                    <span>{group.sellerName} ({group.items.length} items):</span>
                    <span className="tabular-nums font-medium text-[#222222]">${group.sellerSubtotal.toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-[#E5E5E5] pt-1.5 flex justify-between font-bold text-sm text-[#FF6A00]">
                  <span>Total Amount:</span>
                  <span className="tabular-nums">${total.toFixed(2)}</span>
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
                  {isSubmitting ? 'Processing...' : `Confirm & Pay $${total.toFixed(2)}`}
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
                      ${group.sellerSubtotal.toFixed(2)}
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
                            ${item.product.price.toFixed(2)}
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
                <span className="text-[#FF6A00] tabular-nums">${total.toFixed(2)}</span>
              </div>
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
