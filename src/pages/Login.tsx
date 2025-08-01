import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, quickLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate("/");
    } catch {
      toast.error("Invalid credentials");
    }
  };

  const users = [
    { label: "Requestor (Praful)", user: "praful" },
    { label: "Technical Head", user: "baskara" },
    { label: "Plant Head (CMK)", user: "cmk" },
    { label: "Director (Jasveen)", user: "jasveen" },
    { label: "COO (Vishnu)", user: "vishnu" },
    { label: "Admin (Aarnav)", user: "aarnav" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="p-8 bg-white shadow rounded w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Sign In</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block mb-1">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Log In
          </Button>
        </form>

        <div className="mt-6">
          <p className="text-center text-sm text-gray-500 mb-2">Quick Login:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {users.map((u) => (
              <Button
                key={u.user}
                variant="outline"
                size="sm"
                onClick={() => quickLogin(u.user).then(() => navigate("/"))}
              >
                {u.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
