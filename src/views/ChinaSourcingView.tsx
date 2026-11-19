import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, MessageCircle, PlaneTakeoff } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { ChinaRequest } from '../types';

interface ChinaSourcingViewProps {
  onNavigate: (route: string) => void;
}

const WHATSAPP_NUMBER = '250795708460';

const inputClass = 'w-full px-4 py-3 text-sm border border-[#E5E5E5] rounded-xl bg-white text-[#111111] focus:border-[#FF9900] focus:outline-none focus:ring-2 focus:ring-[#FF9900]/25';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export const ChinaSourcingView: React.FC<ChinaSourcingViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [whatsapp, setWhatsapp] = useState(user?.phone || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedRequest, setSubmittedRequest] = useState<ChinaRequest | null>(null);

  useEffect(() => {
    if (!whatsapp && user?.phone) setWhatsapp(user.phone);
  }, [user]);

  const buildWhatsappHref = (request: ChinaRequest) => {
    const message = [
      'Hello Bonfils Store, I just submitted a product sourcing request.',
      '',
      `Request: ${request.requestNumber}`,
      `Product: ${request.productName}`,
      `Quantity: ${request.quantity}`,
      `My WhatsApp: ${request.whatsapp || whatsapp}`,
      '',
      'Please send me more information and pricing.',
    ].join('\n');
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');

    const name = productName.trim();
    const contact = whatsapp.trim();
    const parsedQuantity = Number(quantity);

    if (!name || !Number.isInteger(parsedQuantity) || parsedQuantity < 1 || !contact) {
      setErrorMessage('Please enter a product name, a quantity of at least 1, and your Phone / WhatsApp number.');
      return;
    }
    if (digitsOnly(contact).length < 8) {
      setErrorMessage('Please enter a valid Phone / WhatsApp number.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.submitChinaRequest({
        productName: name,
        quantity: parsedQuantity,
        whatsapp: contact,
        customerPhone: contact,
        customerName: user?.name || 'WhatsApp Customer',
        customerEmail: user?.email,
        description: `Quick sourcing request for ${name}. Contact via WhatsApp: ${contact}.`,
        category: 'General',
        preferredContactMethod: 'whatsapp',
        images: [],
      });
      setSubmittedRequest(response.request);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedRequest) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm overflow-hidden">
          <div className="bg-[#111111] border-b-4 border-[#FF9900] px-6 py-8 text-center text-white">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#FF9900] text-[#111111] flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-extrabold mt-4">Request Received</h1>
            <p className="text-sm text-[#CCCCCC] mt-2">
              Saved to our sourcing desk. Continue on WhatsApp for a faster reply.
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="rounded-xl border border-[#FF9900]/30 bg-[#FFF9EF] p-5 space-y-3">
              <div className="flex justify-between items-center gap-4 border-b border-[#FF9900]/25 pb-3">
                <span className="text-xs text-[#666666]">Request ID</span>
                <span className="text-sm font-extrabold font-mono text-[#111111]">{submittedRequest.requestNumber}</span>
              </div>
              <div className="flex justify-between gap-4 text-xs">
                <span className="text-[#666666]">Product</span>
                <span className="font-semibold text-[#111111] text-right">{submittedRequest.productName}</span>
              </div>
              <div className="flex justify-between gap-4 text-xs">
                <span className="text-[#666666]">Quantity</span>
                <span className="font-semibold text-[#111111]">{submittedRequest.quantity}</span>
              </div>
              <div className="flex justify-between gap-4 text-xs">
                <span className="text-[#666666]">Your WhatsApp</span>
                <span className="font-semibold text-[#111111] text-right">{submittedRequest.whatsapp || whatsapp}</span>
              </div>
            </div>

            <a
              href={buildWhatsappHref(submittedRequest)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#FF9900] hover:bg-[#FFB84D] text-[#111111] text-sm font-extrabold transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              Continue on WhatsApp
            </a>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => onNavigate(`/china-sourcing/${submittedRequest.id}`)}
                className="flex-1 px-5 py-2.5 rounded-lg border border-[#E5E5E5] text-xs font-bold text-[#111111] hover:bg-[#F7F7F7] cursor-pointer"
              >
                Track Request Status
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmittedRequest(null);
                  setProductName('');
                  setQuantity('');
                }}
                className="flex-1 px-5 py-2.5 rounded-lg border border-[#E5E5E5] text-xs font-bold text-[#111111] hover:bg-[#F7F7F7] cursor-pointer"
              >
                Submit Another Request
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        <div className="bg-[#111111] border-b-4 border-[#FF9900] px-6 py-8 text-white">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF9900]">
            <PlaneTakeoff className="w-4 h-4" />
            Product Sourcing
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-3">Request Any Product from China</h1>
          <p className="text-sm text-[#CCCCCC] mt-3 max-w-lg leading-relaxed">
            Tell us the product, quantity and WhatsApp number. Our sourcing team will follow up on WhatsApp with pricing and options.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-[#D92D20]">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label htmlFor="sourcing-product" className="block text-xs font-bold text-[#111111] mb-2">
              Product Name
            </label>
            <input
              id="sourcing-product"
              type="text"
              required
              value={productName}
              onChange={event => setProductName(event.target.value)}
              placeholder="e.g. Bluetooth speaker"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="sourcing-quantity" className="block text-xs font-bold text-[#111111] mb-2">
              Quantity
            </label>
            <input
              id="sourcing-quantity"
              type="number"
              min="1"
              step="1"
              required
              value={quantity}
              onChange={event => setQuantity(event.target.value)}
              placeholder="e.g. 50"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="sourcing-whatsapp" className="block text-xs font-bold text-[#111111] mb-2">
              Phone / WhatsApp Number
            </label>
            <input
              id="sourcing-whatsapp"
              type="tel"
              required
              value={whatsapp}
              onChange={event => setWhatsapp(event.target.value)}
              placeholder="+250 795 708 460"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3.5 rounded-xl bg-[#FF9900] hover:bg-[#FFB84D] text-[#111111] text-sm font-extrabold transition-colors disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? 'Saving request...' : 'SEND REQUEST'}
          </button>

          <p className="text-center text-[11px] text-[#666666]">
            No long forms. We will confirm the details with you on WhatsApp.
          </p>
        </form>
      </div>
    </div>
  );
};
