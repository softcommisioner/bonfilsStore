import React, { useState, useEffect } from 'react';
import { 
  PlaneTakeoff, Ship, Clock, CheckCircle2, AlertCircle, 
  Upload, Link2, Info, ArrowRight, Sparkles 
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { ChinaRequest } from '../types';

interface ChinaSourcingViewProps {
  onNavigate: (route: string) => void;
}

export const ChinaSourcingView: React.FC<ChinaSourcingViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  // Form Fields - Product Information
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Consumer Electronics');
  const [quantity, setQuantity] = useState('10');
  const [preferredBrand, setPreferredBrand] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [estimatedBudget, setEstimatedBudget] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Customer Information (Auto-filled if logged in!)
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [whatsapp, setWhatsapp] = useState(user?.phone || '');
  const [country, setCountry] = useState(user?.country || 'Rwanda');
  const [city, setCity] = useState(user?.city || 'Kigali');
  const [deliveryAddress, setDeliveryAddress] = useState('KG 9 Ave, Nyarutarama');
  const [preferredContactMethod, setPreferredContactMethod] = useState<'whatsapp' | 'email' | 'phone'>('whatsapp');

  // Shipping Preferences
  const [shippingMethod, setShippingMethod] = useState<'air' | 'sea' | 'express'>('air');
  const [maxWaitingTime, setMaxWaitingTime] = useState<'15_days' | '30_days' | '45_days' | 'more_than_45_days'>('30_days');
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal');
  const [preferredDeliveryPeriod, setPreferredDeliveryPeriod] = useState('');
  const [destination, setDestination] = useState('Kigali International Airport / Warehouse');
  const [instructions, setInstructions] = useState('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedRequest, setSubmittedRequest] = useState<ChinaRequest | null>(null);

  useEffect(() => {
    if (user) {
      if (!customerName) setCustomerName(user.name);
      if (!customerEmail) setCustomerEmail(user.email);
      if (!customerPhone) setCustomerPhone(user.phone);
      if (!whatsapp) setWhatsapp(user.phone);
      if (!country) setCountry(user.country);
      if (!city) setCity(user.city);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!productName || !description || !quantity || !customerName || !customerEmail || !customerPhone || !deliveryAddress) {
      setErrorMessage('Please fill in all mandatory product and contact information.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        productName,
        description,
        category,
        quantity: parseInt(quantity, 10),
        preferredBrand,
        modelNumber,
        color,
        size,
        specifications,
        estimatedBudget: estimatedBudget ? parseFloat(estimatedBudget) : undefined,
        referenceUrl,
        images: imageUrl ? [imageUrl] : ['/src/assets/images/hero_logistics_marketplace_1790334780179.jpg'],
        customerName,
        customerEmail,
        customerPhone,
        whatsapp,
        country,
        city,
        deliveryAddress,
        preferredContactMethod,
        shippingMethod,
        maxWaitingTime,
        urgency,
        preferredDeliveryPeriod,
        destination,
        instructions,
      };

      const res = await api.submitChinaRequest(payload);
      setSubmittedRequest(res.request);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {submittedRequest ? (
        /* Success Screen (Requirements 20 & 21) */
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-8 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-[#22A06B] rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
              Procurement Request Received
            </span>
            <h1 className="text-2xl font-extrabold text-[#222222] mt-1">
              Request Submitted Successfully!
            </h1>
            <p className="text-xs text-[#666666] mt-2 max-w-md mx-auto">
              Our sourcing team in China has received your request. We will review factory options, verify specifications, and contact you with an itemized quote.
            </p>
          </div>

          <div className="p-6 bg-[#FFF8F2] border border-[#FF6A00]/30 rounded-xl max-w-md mx-auto text-left space-y-3">
            <div className="flex justify-between items-center border-b border-[#FF6A00]/20 pb-2">
              <span className="text-xs text-[#666666]">Request ID:</span>
              <span className="text-base font-extrabold font-mono text-[#FF6A00]">
                {submittedRequest.requestNumber}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#666666]">Product:</span>
              <span className="font-semibold text-[#222222]">{submittedRequest.productName}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#666666]">Quantity:</span>
              <span className="font-semibold text-[#222222]">{submittedRequest.quantity} units</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#666666]">Shipping Preference:</span>
              <span className="font-semibold text-[#222222] uppercase">{submittedRequest.shippingMethod}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#666666]">Status:</span>
              <span className="font-bold text-[#22A06B]">REQUEST RECEIVED</span>
            </div>
          </div>

          <div className="text-xs text-[#777777] max-w-sm mx-auto">
            A confirmation email was dispatched to <strong>{submittedRequest.customerEmail}</strong>. You can inspect it in the Email & OTP Dispatcher drawer.
          </div>

          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={() => onNavigate(`/china-sourcing/${submittedRequest.id}`)}
              className="px-6 py-2.5 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Track Request Status
            </button>
            <button
              onClick={() => {
                setSubmittedRequest(null);
                setProductName('');
                setDescription('');
              }}
              className="px-6 py-2.5 border border-[#E5E5E5] text-[#444444] text-xs font-semibold rounded-lg hover:bg-[#F7F7F7] cursor-pointer"
            >
              Submit Another Request
            </button>
          </div>
        </div>
      ) : (
        /* Sourcing Request Intake Form */
        <div className="space-y-8">
          
          {/* Header intro */}
          <div className="bg-gradient-to-r from-[#222222] to-[#333333] text-white p-6 sm:p-8 rounded-2xl shadow-md border-b-4 border-[#FF6A00]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#FF8A00] uppercase tracking-wider mb-2">
              <PlaneTakeoff className="w-4 h-4 text-[#FF6A00]" />
              <span>Direct China Factory Procurement & Consolidated Freight</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Request Any Product from China
            </h1>
            <p className="text-xs sm:text-sm text-[#CCCCCC] mt-2 max-w-2xl leading-relaxed">
              Tell us what you want to buy. Our team in Guangzhou, Yiwu, and Shenzhen will locate certified manufacturers, negotiate tier-1 wholesale prices, perform rigorous pre-shipment inspections, and arrange door-to-door air or sea shipping.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E5E5E5] p-6 sm:p-8 shadow-xs space-y-8">
            {errorMessage && (
              <div className="p-4 bg-red-50 border border-red-200 text-[#D92D20] text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* 1. Product Information (Requirement 17) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#F0F0F0]">
                <div className="w-6 h-6 rounded bg-[#FFF3E8] text-[#FF6A00] font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <h3 className="text-sm font-bold text-[#222222] uppercase tracking-wide">
                  Product Information & Specifications
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#444444] mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Commercial Espresso Machine, Wireless CCTV, Solar Inverter..."
                    className="w-full px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#444444] mb-1">
                    Detailed Description & Intended Use <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe functionality, voltage (220V/110V), material, performance requirements, and any special features."
                    className="w-full px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none bg-white"
                  >
                    <option value="Consumer Electronics">Consumer Electronics</option>
                    <option value="Security & Surveillance">Security & Surveillance</option>
                    <option value="Industrial & Hardware">Industrial & Hardware</option>
                    <option value="Commercial Kitchen & Cafe">Commercial Kitchen & Cafe</option>
                    <option value="Solar & Energy">Solar & Energy</option>
                    <option value="Automotive & Spare Parts">Automotive & Spare Parts</option>
                    <option value="Fashion & Apparel">Fashion & Apparel</option>
                    <option value="Other">Other Custom Category</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">
                    Required Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">Preferred Brand / Manufacturer (Optional)</label>
                  <input
                    type="text"
                    value={preferredBrand}
                    onChange={(e) => setPreferredBrand(e.target.value)}
                    placeholder="e.g. OEM or specific brand"
                    className="w-full px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">Model / Part Number (Optional)</label>
                  <input
                    type="text"
                    value={modelNumber}
                    onChange={(e) => setModelNumber(e.target.value)}
                    placeholder="e.g. CM-PRO-900"
                    className="w-full px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">Color / Finish</label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="e.g. Matte Black, Silver, White"
                    className="w-full px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">Size / Dimensions</label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="e.g. 50cm x 40cm, Standard, Large"
                    className="w-full px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#444444] mb-1">Product Reference Link (Alibaba, 1688, Taobao, or YouTube)</label>
                  <div className="flex items-center border border-[#E5E5E5] rounded-lg overflow-hidden focus-within:border-[#FF6A00]">
                    <div className="px-3 bg-[#F7F7F7] text-[#666666] border-r border-[#E5E5E5]">
                      <Link2 className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="url"
                      value={referenceUrl}
                      onChange={(e) => setReferenceUrl(e.target.value)}
                      placeholder="https://1688.com/offer/... or https://alibaba.com/product-detail/..."
                      className="w-full px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#444444] mb-1">Product Sample Image URL</label>
                  <div className="flex items-center border border-[#E5E5E5] rounded-lg overflow-hidden focus-within:border-[#FF6A00]">
                    <div className="px-3 bg-[#F7F7F7] text-[#666666] border-r border-[#E5E5E5]">
                      <Upload className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Image URL or leave empty for our logistics default"
                      className="w-full px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">Estimated Target Budget per Unit or Total ($ USD)</label>
                  <input
                    type="number"
                    value={estimatedBudget}
                    onChange={(e) => setEstimatedBudget(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 2. Shipping Preferences (Requirement 19) */}
            <div className="space-y-4 pt-4 border-t border-[#F0F0F0]">
              <div className="flex items-center gap-2 pb-2 border-b border-[#F0F0F0]">
                <div className="w-6 h-6 rounded bg-[#FFF3E8] text-[#FF6A00] font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <h3 className="text-sm font-bold text-[#222222] uppercase tracking-wide">
                  Shipping & Freight Preferences
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className={`p-3 border rounded-xl cursor-pointer text-xs flex flex-col justify-between ${shippingMethod === 'air' ? 'border-[#FF6A00] bg-[#FFF8F2]' : 'border-[#E5E5E5]'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#222222] flex items-center gap-1.5">
                      <PlaneTakeoff className="w-4 h-4 text-[#FF6A00]" />
                      Air Cargo
                    </span>
                    <input
                      type="radio"
                      name="shippingMethod"
                      checked={shippingMethod === 'air'}
                      onChange={() => setShippingMethod('air')}
                    />
                  </div>
                  <p className="text-[11px] text-[#666666]">
                    7 to 12 business days. Ideal for electronics, urgent parts, and lightweight commercial goods.
                  </p>
                </label>

                <label className={`p-3 border rounded-xl cursor-pointer text-xs flex flex-col justify-between ${shippingMethod === 'sea' ? 'border-[#FF6A00] bg-[#FFF8F2]' : 'border-[#E5E5E5]'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#222222] flex items-center gap-1.5">
                      <Ship className="w-4 h-4 text-[#22A06B]" />
                      Sea Cargo (CBM)
                    </span>
                    <input
                      type="radio"
                      name="shippingMethod"
                      checked={shippingMethod === 'sea'}
                      onChange={() => setShippingMethod('sea')}
                    />
                  </div>
                  <p className="text-[11px] text-[#666666]">
                    35 to 45 days. Best for bulk machinery, heavy tools, furniture, and container shipments.
                  </p>
                </label>

                <label className={`p-3 border rounded-xl cursor-pointer text-xs flex flex-col justify-between ${shippingMethod === 'express' ? 'border-[#FF6A00] bg-[#FFF8F2]' : 'border-[#E5E5E5]'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#222222] flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#FF8A00]" />
                      Express Courier
                    </span>
                    <input
                      type="radio"
                      name="shippingMethod"
                      checked={shippingMethod === 'express'}
                      onChange={() => setShippingMethod('express')}
                    />
                  </div>
                  <p className="text-[11px] text-[#666666]">
                    3 to 5 business days. VIP expedited delivery via DHL / FedEx partner routes.
                  </p>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">
                    How long can you wait? <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={maxWaitingTime}
                    onChange={(e) => setMaxWaitingTime(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none bg-white"
                  >
                    <option value="15_days">Within 15 days</option>
                    <option value="30_days">Within 30 days</option>
                    <option value="45_days">Within 45 days</option>
                    <option value="more_than_45_days">More than 45 days (Flexible)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">Urgency Level</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none bg-white"
                  >
                    <option value="normal">Normal Procurement Timeline</option>
                    <option value="urgent">Urgent Business Need</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#444444] mb-1">Delivery Destination / Cargo Terminal</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g. Kigali Central Cargo Port / Direct Office Delivery"
                    className="w-full px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 3. Customer Information (Requirement 18) */}
            <div className="space-y-4 pt-4 border-t border-[#F0F0F0]">
              <div className="flex items-center gap-2 pb-2 border-b border-[#F0F0F0]">
                <div className="w-6 h-6 rounded bg-[#FFF3E8] text-[#FF6A00] font-bold text-xs flex items-center justify-center">
                  3
                </div>
                <h3 className="text-sm font-bold text-[#222222] uppercase tracking-wide">
                  Customer & Quotation Contact Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">
                    Email Address (For Quotation & OTP updates) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+250 788 000 000"
                    className="w-full px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">WhatsApp Number (For factory video & photo review)</label>
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+250 788 000 000"
                    className="w-full px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#444444] mb-1">Delivery Address</label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Street, District, Plot number"
                    className="w-full px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#444444] mb-1">Preferred Contact Method</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="contactMethod"
                        checked={preferredContactMethod === 'whatsapp'}
                        onChange={() => setPreferredContactMethod('whatsapp')}
                      />
                      <span>WhatsApp (Fastest)</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="contactMethod"
                        checked={preferredContactMethod === 'email'}
                        onChange={() => setPreferredContactMethod('email')}
                      />
                      <span>Email</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="contactMethod"
                        checked={preferredContactMethod === 'phone'}
                        onChange={() => setPreferredContactMethod('phone')}
                      />
                      <span>Phone Call</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit CTA */}
            <div className="pt-4 border-t border-[#F0F0F0]">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <PlaneTakeoff className="w-4 h-4" />
                <span>{isSubmitting ? 'Submitting to Procurement Desk...' : 'SUBMIT CHINA PRODUCT REQUEST'}</span>
              </button>
              <p className="text-[11px] text-[#888888] text-center mt-2.5">
                No immediate payment required. You will receive an itemized quotation to review first.
              </p>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
