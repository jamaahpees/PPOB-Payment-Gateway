import { ChangeEvent, useState } from 'react';
import { FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react';

import { bearerHeaders, readJsonApi } from '../lib/api';

type AdminProduct = Readonly<{
  id: string;
  sku_digiflazz: string;
  name: string;
  category: string;
  provider: string;
  base_price_minor: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}>;

type UploadResponse = Readonly<{
  created: number;
  updated: number;
  products: AdminProduct[];
}>;

type AdminProductUploadProps = Readonly<{
  token: string | null;
  disabled: boolean;
  onUploaded: (products: AdminProduct[], summary: string) => void;
}>;

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  let binary = '';
  for (const value of new Uint8Array(buffer)) {
    binary += String.fromCharCode(value);
  }

  return btoa(binary);
}

export function AdminProductUpload({ token, disabled, onUploaded }: AdminProductUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (token === null || file === null) return;
    setIsUploading(true);
    setError(null);

    try {
      const payload = await readJsonApi<UploadResponse>('/admin/products/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...bearerHeaders(token) },
        body: JSON.stringify({ file_base64: await fileToBase64(file), file_name: file.name }),
      });
      onUploaded(payload.products, `Upload Excel selesai: ${payload.created} produk baru, ${payload.updated} produk diperbarui.`);
      setFile(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload Excel gagal.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-5 rounded-3xl border border-sky-100 bg-sky-50/70 p-4" data-testid="admin-product-upload">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="flex-1 text-sm font-bold text-slate-700">
          File template Excel
          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={disabled || isUploading}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded-2xl border border-sky-200 bg-white px-4 py-2 text-sm outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
          />
        </label>
        <button
          type="button"
          disabled={disabled || isUploading || file === null}
          onClick={() => void handleUpload()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isUploading ? <Loader2 size={17} className="animate-spin" /> : <UploadCloud size={17} />}
          Upload Excel
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">SKU dicocokkan case-insensitive, produk baru dibuat otomatis, dan upload diproses atomik di backend.</p>
      {file && <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700"><FileSpreadsheet size={14} /> {file.name}</p>}
      {error && <div className="mt-3 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}
    </div>
  );
}
