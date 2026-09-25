import React, { useState, useEffect } from 'react';
import { 
  Search, Truck, Ship, PlaneTakeoff, CheckCircle2, 
  MapPin, Clock, ArrowRight, ShieldCheck 
} from 'lucide-react';
import { api } from '../services/api';
import type { ShippingOrder } from '../types';

interface ShippingTrackingViewProps {
  initialTracking?: string;
  onNavigate: (route: string) => void;
}

export const ShippingTrackingView: React.FC<ShippingTrackingViewProps> = ({ initialTracking = '', onNavigate }) => {
  const [trackingInput, setTrackingInput] = useState(initialTracking);
  const [shipment, setShipment] = useState<ShippingOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTrack = async (trkNum: string) => {
    if (!trkNum.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await api.trackShipment(trkNum.trim());
      setShipment(data.shipment);
    } catch (err: any) {
      setError(err.message || 'Tracking number not found.');
      setShipment(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialTracking) {
      handleTrack(initialTracking);
    }
  }, [initialTracking]);

  const stages = [
    { num: 1, label: 'China Supplier' },
    { num: 2, label: 'China Warehouse' },
    { num: 3, label: 'International Transit' },
    { num: 4, label: 'Destination Customs' },
    { num: 5, label: 'Delivered to Customer' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header & Search Bar */}
      <div className="text-center space-y-3">
        <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
          Cross-Border Freight Tracker
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#222222]">
          Track Your Air & Sea Shipments
        </h1>
        <p className="text-xs text-[#666666] max-w-md mx-auto">
          Enter your Bonfils tracking number to view real-time location checkpoints from China to destination.
        </p>

        {/* Input box */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleTrack(trackingInput);
          }}
          className="max-w-xl mx-auto mt-6 flex items-center border-2 border-[#FF6A00] rounded-xl overflow-hidden bg-white shadow-sm"
        >
          <input
            type="text"
            value={trackingInput}
            onChange={(e) => setTrackingInput(e.target.value)}
            placeholder="e.g. BFS-TRK-789214"
            className="w-full px-4 py-3 text-sm text-[#222222] focus:outline-none font-mono"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Search className="w-4 h-4" />
            <span>{isLoading ? 'Searching...' : 'TRACK'}</span>
          </button>
        </form>

        <div className="text-[11px] text-[#888888] pt-1">
          Demo tracking number available to test: <button onClick={() => { setTrackingInput('BFS-TRK-789214'); handleTrack('BFS-TRK-789214'); }} className="text-[#FF6A00] font-mono font-bold hover:underline cursor-pointer">BFS-TRK-789214</button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-[#D92D20] text-xs rounded-xl text-center">
          {error}
        </div>
      )}

      {/* Shipment Details if found */}
      {shipment && (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 sm:p-8 shadow-xs space-y-8 animate-in fade-in">
          
          {/* Card Top Details */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-[#F9F9F8] rounded-xl border border-[#E5E5E5] text-xs">
            <div>
              <span className="text-[#888888]">Tracking Number:</span>
              <div className="font-mono font-bold text-[#FF6A00] text-sm">{shipment.trackingNumber}</div>
            </div>
            <div>
              <span className="text-[#888888]">Carrier / Route:</span>
              <div className="font-semibold text-[#222222] truncate">{shipment.carrier}</div>
            </div>
            <div>
              <span className="text-[#888888]">Transit Method:</span>
              <div className="font-semibold text-[#222222] uppercase">{shipment.method} Cargo</div>
            </div>
            <div>
              <span className="text-[#888888]">Est. Delivery:</span>
              <div className="font-bold text-[#22A06B]">{shipment.estimatedDelivery}</div>
            </div>
          </div>

          {/* 5-Stage Visual Progress Line (Requirement 25) */}
          <div>
            <h3 className="text-xs font-bold text-[#888888] uppercase tracking-wider mb-6">
              5-Stage Freight Pipeline
            </h3>

            <div className="relative">
              {/* Connector line */}
              <div className="hidden sm:block absolute top-4 left-6 right-6 h-0.5 bg-[#E5E5E5] -z-0" />

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                {stages.map((stage) => {
                  const isDone = shipment.currentStage >= stage.num;
                  const isCurrent = shipment.currentStage === stage.num;

                  return (
                    <div key={stage.num} className="flex sm:flex-col items-center gap-3 sm:gap-2 text-left sm:text-center z-10">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isCurrent 
                          ? 'bg-[#FF6A00] text-white ring-4 ring-[#FF6A00]/25 shadow-sm'
                          : isDone
                          ? 'bg-[#22A06B] text-white'
                          : 'bg-[#EEEEEE] text-[#888888]'
                      }`}>
                        {isDone && !isCurrent ? <CheckCircle2 className="w-4 h-4" /> : stage.num}
                      </div>
                      <div>
                        <div className={`text-xs ${isCurrent ? 'font-bold text-[#FF6A00]' : isDone ? 'font-semibold text-[#222222]' : 'text-[#888888]'}`}>
                          {stage.label}
                        </div>
                        <div className="text-[10px] text-[#999999]">
                          {isCurrent ? 'Current Status' : isDone ? 'Completed' : 'Pending'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Detailed Checkpoint Timeline */}
          <div className="pt-4 border-t border-[#F0F0F0]">
            <h3 className="text-xs font-bold text-[#222222] uppercase tracking-wide mb-4">
              Detailed Checkpoint Log
            </h3>

            <div className="relative border-l-2 border-[#E5E5E5] ml-4 pl-5 space-y-6">
              {shipment.checkpoints.map((cp, idx) => (
                <div key={idx} className="relative">
                  <div className={`absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full ring-4 ring-white ${
                    cp.completed ? 'bg-[#22A06B]' : 'bg-[#CCCCCC]'
                  }`} />
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#222222]">{cp.title}</h4>
                    <span className="text-[10px] text-[#888888] font-mono">{cp.date}</span>
                  </div>
                  <div className="text-[11px] text-[#FF6A00] font-medium mt-0.5">{cp.location}</div>
                  <p className="text-[11px] text-[#666666] mt-1">{cp.description}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
