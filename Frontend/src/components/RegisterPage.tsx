import React, { useState } from 'react';
import { Mail, Lock, User, Phone, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { buildApiUrl, readApiError } from '../lib/api';
import { setAuthToken } from '../lib/auth';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
}

export default function RegisterPage({ onNavigate }: RegisterPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(buildApiUrl('/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          password,
          name,
          phone_number: phoneNumber
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Registrasi gagal. Email mungkin sudah terdaftar.'));
      }

      const data = await response.json();
      if (data.token) {
        setAuthToken(data.token);
        localStorage.setItem('bayarku.auth.session', JSON.stringify({
          user: data.user,
          token: data.token,
          expires_in: data.expiresIn || '24h'
        }));
        setSuccess(true);
        setTimeout(() => {
          onNavigate('/dashboard');
        }, 1200);
      } else {
        throw new Error('Token tidak valid dari server.');
      }
    } catch (err: any) {
      setError(err.message || 'Koneksi ke server gagal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
        <button
          onClick={() => onNavigate('/')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Kembali ke Beranda
        </button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Daftar Akun Baru</h2>
          <p className="text-slate-500 text-sm mt-1">Gabung sekarang dan nikmati kemudahan bertransaksi</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-sm flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span>Pendaftaran sukses! Mengalihkan ke dashboard...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-700 text-sm font-semibold mb-1.5">Nama Lengkap</label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                disabled={loading || success}
                placeholder="Budi Santoso"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 text-sm font-semibold mb-1.5">Alamat Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                disabled={loading || success}
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 text-sm font-semibold mb-1.5">Nomor Handphone</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                required
                disabled={loading || success}
                placeholder="08123456789"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 text-sm font-semibold mb-1.5">Kata Sandi</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                disabled={loading || success}
                placeholder="Minimal 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-slate-400 disabled:to-slate-400 text-white font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Mendaftar...
              </>
            ) : (
              'Daftar Sekarang'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Sudah punya akun?{' '}
          <button
            onClick={() => onNavigate('/login')}
            className="font-bold text-amber-600 hover:text-amber-700 transition-colors"
          >
            Masuk Sekarang
          </button>
        </div>
      </div>
    </div>
  );
}
