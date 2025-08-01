import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { CertificationTable } from "@/components/CertificationTable";
import { CertificationForm } from "@/components/CertificationForm";
import { Certification } from "@/lib/types";
import {
  getCertifications,
  addCertification,
  updateCertification,
} from "@/lib/storage";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const Index: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCertification, setSelectedCertification] =
    useState<Certification>();
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">(
    "create"
  );
  const [loading, setLoading] = useState(false);

  // Load certifications on mount
  useEffect(() => {
    loadCertifications();
  }, []);

  const loadCertifications = async () => {
    setLoading(true);
    try {
      const data = await getCertifications();
      // Custom sorting:
      // 1. Overdue items (not completed) at the top
      // 2. In progress and not started in the middle
      // 3. Completed items at the bottom
      data.sort((a, b) => {
        const now = Date.now();
        const aDue = new Date(a.dueDate).getTime();
        const bDue = new Date(b.dueDate).getTime();
        const aOverdue = aDue < now && a.status !== "Completed";
        const bOverdue = bDue < now && b.status !== "Completed";
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        if (a.status === "Completed" && b.status !== "Completed") return 1;
        if (a.status !== "Completed" && b.status === "Completed") return -1;
        return aDue - bDue;
      });
      setCertifications(data);
    } catch (err: any) {
      console.error("Failed to load certifications:", err);
      toast.error(`Error loading certifications: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedCertification(undefined);
    setFormMode("create");
    setIsFormOpen(true);
  };

  const handleEdit = (cert: Certification) => {
    setSelectedCertification(cert);
    setFormMode("edit");
    setIsFormOpen(true);
  };

  const handleView = (cert: Certification) => {
    setSelectedCertification(cert);
    setFormMode("view");
    setIsFormOpen(true);
  };

  const handleSubmit = async (
    data: Omit<
      Certification,
      "id" | "serialNumber" | "createdAt" | "lastUpdatedOn"
    >
  ) => {
    try {
      if (formMode === "create") {
        await addCertification(data);
        toast.success("Certification created successfully");
      } else if (formMode === "edit" && selectedCertification) {
        await updateCertification(selectedCertification.id, data);
        toast.success("Certification updated successfully");
      }
      setIsFormOpen(false);
      await loadCertifications();
    } catch (err: any) {
      console.error("Failed to save certification:", err);
      toast.error(`Save failed: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch {
      toast.error("Logout failed");
    }
  };

  // filter based on global searchTerm
  const filtered = certifications.filter((cert) => {
    const s = searchTerm.toLowerCase();
    return Object.values(cert).some((val) =>
      JSON.stringify(val).toLowerCase().includes(s)
    );
  });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="container mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between">
        {/* Left logo */}
        <div className="mb-4 sm:mb-0">
          <img
            src="/logo.png"
            alt="Premier Energies"
            className="h-28 w-auto p-0 m-0"
          />
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-40 sm:w-48 md:w-64 bg-white-100 border-gray-300 focus:border-brand-500 focus:ring-brand-500"
          />
          {user &&
            (user.role === "Requestor" || user.role === "Admin") && (
              <Button
              variant="outline"
                onClick={handleCreateNew}
                className="bg-brand-500 text-white hover:bg-white hover:text-brand-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Button>
            )}
          <Button variant="outline" className="bg-red-500 text-white hover:bg-white hover:text-red-500" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        {/* Right logo */}
        <div className="mb-4 sm:mb-0">
          <img
            src="/l.png"
            alt="Partner Logo"
            className="h-20 w-auto p-0 m-0"
          />
        </div>
      </header>

      <main className="container mx-auto px-4 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin h-6 w-6 mr-2 text-gray-500" />
            <span className="text-gray-500">Loading certifications…</span>
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="my-4">
              <h2 className="font-semibold mb-2">Legend</h2>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center">
                  <span className="w-4 h-4 bg-red-100 border border-red-300 mr-2" />
                  Overdue
                </div>
                <div className="flex items-center">
                  <span className="w-4 h-4 bg-sky-100 border border-sky-300 mr-2" />
                  Not Started Yet
                </div>
                <div className="flex items-center">
                  <span className="w-4 h-4 bg-yellow-100 border border-yellow-300 mr-2" />
                  In Progress
                </div>
                <div className="flex items-center">
                  <span className="w-4 h-4 bg-green-100 border border-green-300 mr-2" />
                  Completed
                </div>
              </div>
            </div>

            <CertificationTable
              certifications={filtered}
              onEdit={handleEdit}
              onView={handleView}
              onDataChange={loadCertifications}
            />
          </>
        )}

        <CertificationForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
          initialData={selectedCertification}
          mode={formMode}
        />
      </main>

      <footer className="bg-gray-100 py-4">
        <p className="text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Premier Energies Limited Certify Pro
        </p>
      </footer>
    </div>
  );
};

export default Index;
