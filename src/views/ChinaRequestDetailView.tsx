import React, { useState, useEffect } from 'react';
import { 
  PlaneTakeoff, ArrowLeft, CheckCircle2, Clock, AlertCircle, 
  DollarSign, ShieldCheck, MapPin, Truck, ChevronRight 
} from 'lucide-react';
import { api } from '../services/api';
import type { ChinaRequest, Quotation } from '../types';

interface ChinaRequestDetailViewProps {
  requestId: string;
  onNavigate: (route: string) => void;
}

export const ChinaRequestDetailView: React.FC<ChinaRequestDetailViewProps> = ({ requestId, onNavigate }) => {
  const [request, setRequest] = useState<ChinaRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);
  const [responseNotes, setResponseNotes] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchRequest = async () => {
    setIsLoading(true);
    try {
      const data = await api.getChinaRequest(requestId);
      setRequest(data.request);
    } catch (err) {
      console.error('Error fetching China request', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequest();
  }, [requestId]);

  const handleQuotationResponse = async (action: 'accept' | 'reject') => {
    if (!request) return;
    setIsResponding(true);
    try {
      const res = await api.respondQuotation(request.id, {
        action,
        notes: responseNotes,
      });
      setRequest(res.request);
      setActionSuccess(action === 'accept' ? 'Quotation accepted! Proceeding to order invoice.' : 'Quotation adjustment requested.');
    } catch (err: any) {
      alert(err.message || 'Error updating quotation.');
    } finally {
      setIsResponding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-xs text-[#888888]">
        Loading sourcing request status...
      </div>
    );
  }

  if (!request) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-lg font-bold text-[#222222]">Request Not Found</h2>
        <button
          onClick={() => onNavigate('/account?tab=china-requests')}
          className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg text-xs font-bold cursor-pointer"
        >
          Back to Requests
        </button>
      </div>
    );
  }

  const stages = [
    { key: 'REQUEST_RECEIVED', label: 'Received' },
    { key: 'UNDER_REVIEW', label: 'Under Review' },
    { key: 'SUPPLIER_FOUND', label: 'Supplier Matched' },
    { key: 'CUSTOMER_CONFIRMATION', label: 'Quotation Ready' },
    { key: 'PURCHASED', label: 'Purchased' },
    { key: 'SHIPPING', label: 'Container Sealed' },
    { key: 'IN_TRANSIT', label: 'In Transit' },
    { key: 'DELIVERED', label: 'Delivered' },
  ];

  const currentStageIndex = stages.findIndex(s => s.key === request.status);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('/account?tab=china-requests')}
          className="text-xs text-[#666666] hover:text-[#FF6A00] flex items-center gap-1 cursor-pointer font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Sourcing Requests</span>
        </button>

        <span className="font-mono text-xs font-bold px-2.5 py-1 bg-[#FFF3E8] text-[#FF6A00] rounded border border-[#FF6A00]/30">
          {request.requestNumber}
        </span>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-[#22A06B] text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Request Header */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#888888] mb-1">
              <span>{request.category}</span>
              <span>·</span>
              <span>Quantity: {request.quantity}</span>
              <span>·</span>
              <span className="uppercase">{request.shippingMethod} Shipping</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#222222]">
              {request.productName}
            </h1>
            <p className="text-xs text-[#555555] mt-1.5 leading-relaxed max-w-2xl">
              {request.description}
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="inline-block px-3 py-1.5 rounded-lg text-xs font-extrabold bg-[#FFF3E8] text-[#FF6A00] border border-[#FF6A00]/20">
              {request.status.replace(/_/g, ' ')}
            </span>
            <div className="text-[11px] text-[#888888] mt-1">
              Created: {new Date(request.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Visual Progress Bar (Requirement 22) */}
        <div className="pt-4 border-t border-[#F0F0F0]">
          <h4 className="text-xs font-bold text-[#888888] uppercase tracking-wider mb-4">
            Procurement & Logistics Progress
          </h4>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {stages.map((stage, idx) => {
              const isPast = currentStageIndex >= idx;
              const isCurrent = stage.key === request.status;
              return (
                <div key={stage.key} className="flex flex-col items-center text-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 transition-all ${
                    isCurrent
                      ? 'bg-[#FF6A00] text-white ring-4 ring-[#FF6A00]/20'
                      : isPast
                      ? 'bg-[#22A06B] text-white'
                      : 'bg-[#EEEEEE] text-[#888888]'
                  }`}>
                    {isPast && !isCurrent ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`text-[10px] leading-tight ${isCurrent ? 'font-bold text-[#FF6A00]' : isPast ? 'font-medium text-[#222222]' : 'text-[#999999]'}`}>
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Quotation Review (Requirement 24) */}
        <div className="lg:col-span-7 space-y-6">
          {request.quotation ? (
            <div className="bg-white rounded-2xl border-2 border-[#FF6A00]/40 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0F0F0]">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-[#FFF3E8] text-[#FF6A00] rounded-md">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#222222]">Official Sourcing Quotation</h3>
                    <p className="text-[11px] text-[#666666]">Issued by Bonfils Procurement Team</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  request.quotation.status === 'accepted' ? 'bg-emerald-50 text-[#22A06B]' :
                  request.quotation.status === 'rejected' ? 'bg-red-50 text-[#D92D20]' :
                  'bg-[#FFF3E8] text-[#FF6A00]'
                }`}>
                  Status: {request.quotation.status.toUpperCase()}
                </span>
              </div>

              {/* Itemized breakdown table */}
              <div className="divide-y divide-[#F0F0F0] text-xs">
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#666666]">Factory Product Cost ({request.quantity} units):</span>
                  <span className="font-semibold text-[#222222] tabular-nums">${request.quotation.productCost.toFixed(2)}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#666666]">China Domestic Warehouse Freight:</span>
                  <span className="font-semibold text-[#222222] tabular-nums">${request.quotation.chinaLocalShipping.toFixed(2)}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#666666]">International Air/Sea Freight ({request.shippingMethod.toUpperCase()}):</span>
                  <span className="font-semibold text-[#222222] tabular-nums">${request.quotation.internationalShipping.toFixed(2)}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#666666]">Procurement, Quality Inspection & Handling:</span>
                  <span className="font-semibold text-[#222222] tabular-nums">${request.quotation.serviceFee.toFixed(2)}</span>
                </div>
                <div className="py-3 flex justify-between text-base font-extrabold text-[#FF6A00] bg-[#FFF8F2] px-3 rounded-lg">
                  <span>TOTAL PAYABLE:</span>
                  <span className="tabular-nums">${request.quotation.total.toFixed(2)}</span>
                </div>
              </div>

              {request.quotation.notes && (
                <div className="p-3 bg-[#F9F9F8] rounded-lg text-xs text-[#555555]">
                  <strong>Procurement Specialist Notes:</strong> {request.quotation.notes}
                </div>
              )}

              {/* Customer Quotation Actions */}
              {request.quotation.status === 'pending' && (
                <div className="pt-2 border-t border-[#F0F0F0] space-y-3">
                  <label className="block text-xs font-semibold text-[#444444]">
                    Add Feedback / Note (Optional):
                  </label>
                  <input
                    type="text"
                    value={responseNotes}
                    onChange={(e) => setResponseNotes(e.target.value)}
                    placeholder="e.g. Can we negotiate a discount for 20 units?"
                    className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleQuotationResponse('reject')}
                      disabled={isResponding}
                      className="py-2.5 border border-[#E5E5E5] text-[#666666] text-xs font-semibold rounded-lg hover:bg-[#F7F7F7] cursor-pointer"
                    >
                      Request Revision / Decline
                    </button>
                    <button
                      onClick={() => handleQuotationResponse('accept')}
                      disabled={isResponding}
                      className="py-2.5 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Accept Quotation</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs text-center py-10 space-y-3">
              <Clock className="w-10 h-10 text-[#FF6A00] mx-auto animate-pulse" />
              <h3 className="text-sm font-bold text-[#222222]">Quotation in Preparation</h3>
              <p className="text-xs text-[#666666] max-w-md mx-auto">
                Our China procurement desk is actively checking factory floor prices and container slots. You will receive an email as soon as the quote is ready.
              </p>
            </div>
          )}

          {/* Active Live Shipping Tracking if in transit */}
          {request.trackingNumber && (
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#22A06B]" />
                  <h3 className="text-sm font-bold text-[#222222]">International Shipping En Route</h3>
                </div>
                <button
                  onClick={() => onNavigate(`/shipping?trk=${request.trackingNumber}`)}
                  className="text-xs font-bold text-[#FF6A00] hover:underline cursor-pointer"
                >
                  Live Tracking View →
                </button>
              </div>

              <div className="p-3 bg-[#F9F9F8] rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#666666]">Carrier:</span>
                  <span className="font-semibold text-[#222222]">{request.carrier || 'Bonfils International Freight'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666666]">Tracking Number:</span>
                  <span className="font-mono font-bold text-[#FF6A00]">{request.trackingNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666666]">Destination:</span>
                  <span className="font-medium text-[#222222]">{request.destination}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Timeline History */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#222222] uppercase tracking-wide">
              Status History & Activity
            </h3>

            <div className="relative border-l-2 border-[#E5E5E5] ml-3 pl-4 space-y-5">
              {request.statusHistory.map((item, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[23px] top-0.5 w-3 h-3 rounded-full bg-[#FF6A00] ring-4 ring-white" />
                  <div className="text-xs font-bold text-[#222222]">{item.status.replace(/_/g, ' ')}</div>
                  <div className="text-[11px] text-[#666666] mt-0.5">{item.note}</div>
                  <div className="text-[10px] text-[#999999] mt-1">
                    By {item.updatedBy} · {new Date(item.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assigned Staff Card */}
          {request.assignedStaffName && (
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-5 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FFF3E8] text-[#FF6A00] flex items-center justify-center font-bold text-xs">
                {request.assignedStaffName.charAt(0)}
              </div>
              <div className="text-xs">
                <div className="text-[#888888]">Assigned Sourcing Specialist</div>
                <div className="font-bold text-[#222222]">{request.assignedStaffName}</div>
                <div className="text-[11px] text-[#22A06B] font-medium">Guangzhou & East Africa Desk</div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
