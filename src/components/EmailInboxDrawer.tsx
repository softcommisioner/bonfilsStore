import React, { useState, useEffect } from 'react';
import { Mail, X, RefreshCw, KeyRound, ExternalLink, Check, Copy } from 'lucide-react';
import { api } from '../services/api';
import type { EmailRecord } from '../types';

interface EmailInboxDrawerProps {
  onFillOtp?: (code: string) => void;
}

export const EmailInboxDrawer: React.FC<EmailInboxDrawerProps> = ({ onFillOtp }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchEmails = async () => {
    setIsLoading(true);
    try {
      const data = await api.getRecentEmails();
      setEmails(data.emails || []);
    } catch (err) {
      console.error('Failed to fetch transactional emails', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEmails();
    }
  }, [isOpen]);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    if (onFillOtp) {
      onFillOtp(code);
    }
    setTimeout(() => setCopiedId(null), 2000);
  };

  const latestOtpEmail = emails.find(e => e.otpCode);

  return (
    <>
      {/* Floating launcher trigger */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2.5 bg-[#222222] hover:bg-[#333333] text-white rounded-full shadow-lg border border-[#444444] text-xs font-semibold cursor-pointer transition-all hover:scale-105"
          title="Inspect Dispatched Transactional Emails & Verification Codes"
        >
          <div className="relative">
            <Mail className="w-4 h-4 text-[#FF6A00]" />
            {emails.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#FF6A00] rounded-full animate-ping" />
            )}
          </div>
          <span>Email & OTP Dispatcher</span>
          {latestOtpEmail?.otpCode && (
            <span className="bg-[#FF6A00] text-white text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
              {latestOtpEmail.otpCode}
            </span>
          )}
        </button>
      </div>

      {/* Drawer Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-[#E5E5E5] animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#F7F7F7]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#FFF3E8] text-[#FF6A00] rounded-md">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#222222]">Transactional Emails & OTP Dispatch</h3>
                  <p className="text-[11px] text-[#666666]">Real-time system mail delivery queue</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={fetchEmails}
                  disabled={isLoading}
                  className="p-1.5 text-[#666666] hover:text-[#222222] hover:bg-white rounded transition-colors cursor-pointer"
                  title="Refresh emails"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setSelectedEmail(null);
                  }}
                  className="p-1.5 text-[#666666] hover:text-[#222222] hover:bg-white rounded transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Email Detail View or Email List */}
            {selectedEmail ? (
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="p-3 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between">
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="text-xs text-[#FF6A00] hover:underline font-semibold cursor-pointer"
                  >
                    ← Back to inbox
                  </button>
                  {selectedEmail.otpCode && (
                    <button
                      onClick={() => handleCopy(selectedEmail.otpCode!, selectedEmail.id)}
                      className="flex items-center gap-1 text-xs bg-[#FF6A00] text-white px-2.5 py-1 rounded font-medium cursor-pointer"
                    >
                      {copiedId === selectedEmail.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === selectedEmail.id ? 'Copied!' : `Use OTP ${selectedEmail.otpCode}`}</span>
                    </button>
                  )}
                </div>
                <div className="p-4 border-b border-[#E5E5E5] space-y-1">
                  <div className="text-xs text-[#888888]">To: <strong className="text-[#222222]">{selectedEmail.to}</strong></div>
                  <div className="text-xs text-[#888888]">Subject: <strong className="text-[#222222]">{selectedEmail.subject}</strong></div>
                  <div className="text-[11px] text-[#999999]">{new Date(selectedEmail.sentAt).toLocaleTimeString()}</div>
                </div>
                <div 
                  className="flex-1 p-4 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.html }}
                />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {emails.length === 0 ? (
                  <div className="text-center py-12 text-[#888888] space-y-2">
                    <Mail className="w-8 h-8 mx-auto text-[#CCCCCC]" />
                    <p className="text-sm font-medium">No transactional emails dispatched yet.</p>
                    <p className="text-xs text-[#AAAAAA]">Submit registration, request a login OTP, or place an order to trigger emails.</p>
                  </div>
                ) : (
                  emails.map((email) => (
                    <div
                      key={email.id}
                      className="p-3.5 rounded-lg border border-[#E5E5E5] bg-white hover:border-[#FF6A00]/50 transition-all shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-[11px] font-bold text-[#FF6A00] uppercase tracking-wide">
                          {email.purpose.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-[#888888]">
                          {new Date(email.sentAt).toLocaleTimeString()}
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-[#222222] mb-1">
                        {email.subject}
                      </h4>
                      <p className="text-[11px] text-[#666666] mb-2 truncate">
                        Recipient: {email.to}
                      </p>

                      {/* Prominent OTP Code Badge if present */}
                      {email.otpCode && (
                        <div className="p-2 rounded bg-[#FFF3E8] border border-[#FF6A00]/30 flex items-center justify-between my-2">
                          <div className="flex items-center gap-1.5">
                            <KeyRound className="w-4 h-4 text-[#FF6A00]" />
                            <span className="text-xs font-bold text-[#222222]">OTP Code:</span>
                            <span className="text-base font-extrabold font-mono tracking-wider text-[#FF6A00]">
                              {email.otpCode}
                            </span>
                          </div>
                          <button
                            onClick={() => handleCopy(email.otpCode!, email.id)}
                            className="text-xs font-medium text-[#FF6A00] hover:bg-white px-2 py-1 rounded transition-colors cursor-pointer flex items-center gap-1"
                          >
                            {copiedId === email.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#22A06B]" />
                                <span className="text-[#22A06B]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Code</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => setSelectedEmail(email)}
                          className="text-[11px] font-semibold text-[#666666] hover:text-[#222222] flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>View Full Email</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="p-3 border-t border-[#E5E5E5] bg-[#F7F7F7] text-center text-[11px] text-[#888888]">
              Dispatched with transactional templates · Tested in development sandbox
            </div>
          </div>
        </div>
      )}
    </>
  );
};
