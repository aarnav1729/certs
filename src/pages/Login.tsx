// src/pages/Login.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import ii from "@/assets/logo.png";      // adjust paths if needed
import rightlogo from "@/assets/l.png";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"enterEmail" | "enterOtp">("enterEmail");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const sendCode = async () => {
    setLoading(true);
    setError(null);
    try {
      await sendOtp(`${email}@premierenergies.com`);
      setStep("enterOtp");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setLoading(true);
    setError(null);
    try {
      await verifyOtp(`${email}@premierenergies.com`, otp);
      navigate("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="w-full flex justify-between items-center bg-white shadow-sm p-4">
        <img src={ii} alt="Logo" className="h-16 object-contain" />
        <img src={rightlogo} alt="Right Logo" className="h-12 object-contain" />
      </header>

      <div className="flex-grow flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
          {error && <div className="mb-4 text-red-600 text-center">{error}</div>}

          {step === "enterEmail" ? (
            <>
              <label className="block mb-1">Username (without @premierenergies.com)</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="eg: aarnav.singh"
                className="mb-4"
                required
              />
              <button
                onClick={sendCode}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                {loading ? "Sending OTP…" : "Send OTP"}
              </button>
            </>
          ) : (
            <>
              <label className="block mb-1">Enter OTP</label>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code"
                className="mb-4"
                required
              />
              <button
                onClick={verifyCode}
                disabled={loading}
                className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
              >
                {loading ? "Verifying…" : "Verify & Login"}
              </button>
            </>
          )}
        </div>
      </div>

      <footer className="w-full p-4 bg-gray-100 text-center text-sm text-gray-600">
        © {new Date().getFullYear()} Premier Energies Limited
      </footer>
    </div>
  );
}