import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Scan from './pages/Scan';
import DataList from './pages/DataList';
import ManageUsers from './pages/ManageUsers';
import DeliveryNotes from './pages/DeliveryNotes';
import ShippingBoard from './pages/ShippingBoard';
import DestySettings from './pages/DestySettings';
import Layout from './components/Layout';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (user: User) => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      // Proteksi Arwah Penasaran (Ghost Employee)
      // Jika data role null, artinya Admin telah MEMECAT akun ini dari database!
      if (data?.role) {
        setUserRole(data.role as 'admin' | 'staff');
      } else {
        await supabase.auth.signOut();
        alert("AKSES DITOLAK: Lisensi Kepegawaian Anda telah dihanguskan oleh Kepala Gudang.");
        // Abaikan set role, biarkan dia terlempar keluar
      }
    } catch (err) {
      console.error('Error memuat hak akses keamanan:', err);
      // Jangan asal jadikan staff jika error, cegah akses
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        if (s?.user) {
          fetchRole(s.user);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        // Supabase tidak terjangkau — jangan biarkan layar loading macet selamanya
        console.error('Gagal memuat sesi:', err);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) fetchRole(s.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Halaman Loading tingkat dewa
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <div className="animate-spin" style={{ width: '48px', height: '48px', border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', marginBottom: '1rem' }}></div>
        <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Menyinkronisasi Keamanan & Data...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={!session ? <Login /> : <Navigate to="/" />}
        />

        {/* Area Web yang Butuh Akses Login */}
        <Route
          path="/"
          element={session ? <Layout userRole={userRole} /> : <Navigate to="/login" />}
        >
          <Route index element={<Dashboard userRole={userRole} />} />
          <Route path="scan" element={<Scan />} />
          <Route path="berita-acara" element={<DeliveryNotes />} />

          {/* HANYA Admin yang boleh akses Menu Super (Data Ekspor & Manage Karyawan & Desty) */}
          <Route path="data" element={userRole === 'admin' ? <DataList /> : <Navigate to="/scan" />} />
          <Route path="karyawan" element={userRole === 'admin' ? <ManageUsers /> : <Navigate to="/scan" />} />
          <Route path="pengiriman" element={userRole === 'admin' ? <ShippingBoard /> : <Navigate to="/scan" />} />
          <Route path="desty" element={userRole === 'admin' ? <DestySettings /> : <Navigate to="/scan" />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
