'use client';

import React, { useState, useEffect } from 'react';
import { IconX, IconCopy, IconCheck, IconQrcode, IconExternalLink, IconShieldCheck, IconUsers } from '@tabler/icons-react';

interface ShareSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessionName: string;
  joinPin: string;
}

export function ShareSessionModal({
  isOpen,
  onClose,
  sessionId,
  sessionName,
  joinPin,
}: ShareSessionModalProps) {
  const [activeTab, setActiveTab] = useState<'players' | 'hosts'>('players');
  const [copied, setCopied] = useState(false);
  const [copiedHost, setCopiedHost] = useState(false);
  const [joinUrl, setJoinUrl] = useState('');
  const [hostUrl, setHostUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setJoinUrl(`${window.location.origin}/live/${sessionId}`);
      setHostUrl(`${window.location.origin}/admin/${sessionId}`);
    }
  }, [sessionId]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCopyHost = async () => {
    try {
      await navigator.clipboard.writeText(hostUrl);
      setCopiedHost(true);
      setTimeout(() => setCopiedHost(false), 2500);
    } catch {
      setCopiedHost(true);
      setTimeout(() => setCopiedHost(false), 2500);
    }
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    joinUrl
  )}&bgcolor=FAF8F5&color=3E2F23&margin=2`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(62, 47, 35, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '440px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid rgba(62, 47, 35, 0.12)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Header */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(62, 47, 35, 0.08)',
            backgroundColor: 'var(--color-cream-light)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--color-terracotta)' }}>
              {activeTab === 'players' ? <IconQrcode size={20} /> : <IconShieldCheck size={20} />}
            </span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-umber)', margin: 0 }}>
              {activeTab === 'players' ? 'Share Player Hub' : 'Host & Co-Host Access'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-umber-muted)',
              padding: '4px',
            }}
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Tab Buttons */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            borderBottom: '1px solid #EFEAE3',
            backgroundColor: '#FAF8F5',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('players')}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: 'none',
              borderBottom: activeTab === 'players' ? '2px solid var(--color-terracotta)' : '2px solid transparent',
              backgroundColor: activeTab === 'players' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'players' ? 'var(--color-terracotta)' : 'var(--color-umber-muted)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <IconUsers size={16} /> Players (QR & Live)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hosts')}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: 'none',
              borderBottom: activeTab === 'hosts' ? '2px solid var(--color-terracotta)' : '2px solid transparent',
              backgroundColor: activeTab === 'hosts' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'hosts' ? 'var(--color-terracotta)' : 'var(--color-umber-muted)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <IconShieldCheck size={16} /> Co-Host Access
          </button>
        </div>

        {/* Content */}
        {activeTab === 'players' ? (
          <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-umber)' }}>
                {sessionName}
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-umber-muted)' }}>
                Players scan the QR code to join the queue, view active courts, or track their profile.
              </p>
            </div>

            {/* QR Code */}
            <div
              style={{
                padding: '12px',
                backgroundColor: '#FAF8F5',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(62, 47, 35, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl}
                alt="Session Check-In QR Code"
                width={200}
                height={200}
                style={{ display: 'block', borderRadius: '4px' }}
              />
            </div>

            {/* PIN Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: 'var(--color-cream-light)',
                padding: '10px 18px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(62, 47, 35, 0.1)',
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-umber-muted)' }}>
                Session PIN:
              </span>
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.1em',
                  color: 'var(--color-terracotta)',
                }}
              >
                {joinPin}
              </span>
            </div>

            {/* Link Box + Copy Button */}
            <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                readOnly
                value={joinUrl}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(62, 47, 35, 0.2)',
                  fontSize: '0.825rem',
                  color: 'var(--color-umber)',
                  backgroundColor: '#FAFAF8',
                }}
              />
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: copied ? 'var(--color-olive)' : 'var(--color-terracotta)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <a
              href={joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--color-terracotta)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                textDecoration: 'none',
              }}
            >
              Open Live Page in new tab <IconExternalLink size={14} />
            </a>
          </div>
        ) : (
          <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', width: '100%' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-umber)' }}>
                Multi-Device Host Management
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--color-umber-muted)', lineHeight: 1.4 }}>
                Share this link with co-hosts to manage courts and the queue together from other phones, tablets, or laptops.
              </p>
            </div>

            <div
              style={{
                backgroundColor: '#FAF8F5',
                border: '1px solid #EFEAE3',
                borderRadius: '12px',
                padding: '16px',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-umber-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                How Co-Hosts Connect
              </div>
              <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', color: '#5C4E42', lineHeight: '1.6' }}>
                <li>Send them the Host Link below.</li>
                <li>When prompted on their device, they enter the <strong>Session PIN</strong>.</li>
                <li>They instantly gain full host admin access to this session.</li>
              </ol>
            </div>

            {/* PIN Highlight */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                backgroundColor: 'var(--color-cream-light)',
                padding: '12px 20px',
                borderRadius: '10px',
                border: '1px solid rgba(62, 47, 35, 0.1)',
                width: '100%',
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-umber-muted)' }}>
                Session PIN:
              </span>
              <span
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.12em',
                  color: 'var(--color-terracotta)',
                }}
              >
                {joinPin}
              </span>
            </div>

            {/* Host Link Box + Copy Button */}
            <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                readOnly
                value={hostUrl}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(62, 47, 35, 0.2)',
                  fontSize: '0.825rem',
                  color: 'var(--color-umber)',
                  backgroundColor: '#FAFAF8',
                }}
              />
              <button
                type="button"
                onClick={handleCopyHost}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: copiedHost ? 'var(--color-olive)' : 'var(--color-terracotta)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {copiedHost ? <IconCheck size={16} /> : <IconCopy size={16} />}
                {copiedHost ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <a
              href={hostUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--color-terracotta)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                textDecoration: 'none',
              }}
            >
              Open Host Link in new window <IconExternalLink size={14} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
