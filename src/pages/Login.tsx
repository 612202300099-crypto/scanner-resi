import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ScanLine, LogIn } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setErrorMsg('Gagal masuk. Periksa email dan password Anda.');
            }
        } catch (err) {
            console.error('Login error:', err);
            setErrorMsg('Server tidak merespons. Periksa koneksi Anda, lalu coba lagi.');
        }
        setLoading(false);
    };

    return (
        <div className="auth-container">
            <div className="card auth-card">
                <div className="auth-header">
                    <ScanLine size={48} color="var(--primary)" style={{ margin: '0 auto 1rem' }} />
                    <h1>Sistem Resi</h1>
                    <p>Silakan masuk menggunakan akun Anda</p>
                </div>

                {errorMsg && (
                    <div className="alert alert-danger" style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label className="input-label">Email</label>
                        <input
                            type="email"
                            className="input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Masukkan email"
                            required
                        />
                    </div>

                    <div className="input-group" style={{ marginBottom: '2rem' }}>
                        <label className="input-label">Kata Sandi</label>
                        <input
                            type="password"
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Masukkan kata sandi"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        disabled={loading}
                    >
                        {loading ? 'Memproses...' : (
                            <>
                                <span>Masuk</span>
                                <LogIn size={20} />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
