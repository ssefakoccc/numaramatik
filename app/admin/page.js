'use client';
import { useState } from 'react';

export default function AdminPage() {
  const [phone, setPhone] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Güncelleniyor...');
    const res = await fetch('/api/update-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, secretKey }),
    });
    if (res.ok) {
      setStatus('✅ Numara başarıyla güncellendi!');
      setPhone('');
    } else {
      setStatus('❌ Hata: Şifre yanlış veya işlem başarısız.');
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h2 className="text-xl font-bold text-center mb-4">Numara Güncelle</h2>
        <input
          type="text"
          placeholder="Yeni Numara (+905...)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-emerald-500 transition-colors"
          required
        />
        <input
          type="password"
          placeholder="Admin Şifresi"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          className="w-full p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-emerald-500 transition-colors"
          required
        />
        <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl text-zinc-950 transition-all active:scale-95">
          Kaydet
        </button>
        {status && <p className="text-center text-sm mt-4 text-zinc-400">{status}</p>}
      </form>
    </main>
  );
}
