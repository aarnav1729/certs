import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Edit, Check, X } from "lucide-react";
import { format } from "date-fns";
import { Certification } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { updateApproval } from "@/lib/storage";

const roleToStageMap: Record<string, "technicalHead" | "plantHead" | "director" | "coo"> = {
  TechnicalHead: "technicalHead",
  PlantHead: "plantHead",
  Director: "director",
  COO: "coo",
};

interface CertificationTableProps {
  certifications: Certification[];
  onEdit: (certification: Certification) => void;
  onView: (certification: Certification) => void;
  onDataChange: () => void;
}

export function CertificationTable({
  certifications,
  onEdit,
  onView,
  onDataChange,
}: CertificationTableProps) {
  const { user } = useAuth();

  // Per-column filters
  const [filters, setFilters] = React.useState<Record<string, string>>({});

  // Sort configuration
  const [sortConfig, setSortConfig] = React.useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy");
    } catch {
      return dateString;
    }
  };

  // Determine row background by status/due date
  const getRowBackground = (cert: Certification) => {
    const now = new Date();
    const due = new Date(cert.dueDate);
    if (due < now && cert.status !== "Completed") return "bg-red-100";
    switch (cert.status) {
      case "Not Started Yet":
        return "bg-sky-100";
      case "In Progress":
        return "bg-yellow-100";
      case "Completed":
        return "bg-green-100";
      default:
        return "";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Not Started Yet":
        return "bg-gray-500 text-white border-gray-500";
      case "In Progress":
        return "bg-status-inprogress text-white border-status-inprogress";
      case "Completed":
        return "bg-status-complete text-white border-status-complete";
      default:
        return "bg-gray-500 text-white border-gray-500";
    }
  };

  const getApprovalColor = (status: string) => {
    switch (status) {
      case "Pending":
        return "bg-yellow-500 text-white border-yellow-500";
      case "Approved":
        return "bg-green-500 text-white border-green-500";
      case "Rejected":
        return "bg-red-500 text-white border-red-500";
      default:
        return "bg-gray-500 text-white border-gray-500";
    }
  };

  // Who can approve?
  const canApprove =
    user?.role === "TechnicalHead" ||
    user?.role === "PlantHead" ||
    user?.role === "Director" ||
    user?.role === "COO";

  // Handler to update sorting
  const handleSort = (key: string) => {
    if (sortConfig?.key === key) {
      // toggle direction
      setSortConfig({
        key,
        direction: sortConfig.direction === "asc" ? "desc" : "asc",
      });
    } else {
      setSortConfig({ key, direction: "asc" });
    }
  };

  // Helper to flag rejected at any stage
  const isRejected = (cert: Certification) =>
    cert.technicalHeadStatus === "Rejected" ||
    cert.plantHeadStatus === "Rejected" ||
    cert.directorStatus === "Rejected" ||
    cert.cooStatus === "Rejected";

  // Build filtered + sorted list
  let displayed = certifications.filter((cert) =>
    Object.entries(filters).every(([field, val]) => {
      if (!val) return true;
      const cell = (cert as any)[field];
      if (Array.isArray(cell)) {
        return cell.join(", ").toLowerCase().includes(val.toLowerCase());
      }
      return String(cell || "")
        .toLowerCase()
        .includes(val.toLowerCase());
    })
  );
  if (sortConfig) {
    const { key, direction } = sortConfig;
    displayed = [...displayed].sort((a, b) => {
      const aVal = (a as any)[key];
      const bVal = (b as any)[key];
      if (aVal == null && bVal != null) return -1;
      if (aVal != null && bVal == null) return 1;
      if (aVal > bVal) return direction === "asc" ? 1 : -1;
      if (aVal < bVal) return direction === "asc" ? -1 : 1;
      return 0;
    });
  }

  // Move any rejected records to bottom
  const nonRejected = displayed.filter((c) => !isRejected(c));
  const rejected = displayed.filter((c) => isRejected(c));
  displayed = [...nonRejected, ...rejected];

  const handleApproval = async (
    cert: Certification,
    action: "Approved" | "Rejected"
  ) => {
    let comment = "";
    if (action === "Rejected") {
      comment = window
        .prompt("Please enter a comment for rejection:")
        ?.trim() || "";
      if (!comment) {
        window.alert("Rejection requires a comment.");
        return;
      }
    } else {
      comment =
        window.prompt("Optional comment for approval:")?.trim() || "";
    }

    try {
      const stage = roleToStageMap[user!.role];
      await updateApproval(cert.id, stage, action, comment);
      onDataChange();
    } catch (err: any) {
      console.error("Approval error:", err);
      window.alert("Failed to submit approval. Please try again.");
    }
  };

  return (
    <div className="rounded-md border bg-white overflow-x-auto">
      <Table>
        <TableHeader>
          {/* Sortable headers */}
          <TableRow className="bg-gray-50">
            <TableHead
              className="w-[80px] cursor-pointer"
              onClick={() => handleSort("serialNumber")}
            >
              S/N{" "}
              {sortConfig?.key === "serialNumber"
                ? sortConfig.direction === "asc"
                  ? "▲"
                  : "▼"
                : ""}
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("projectName")}
            >
              Project Name{" "}
              {sortConfig?.key === "projectName"
                ? sortConfig.direction === "asc"
                  ? "▲"
                  : "▼"
                : ""}
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("material")}
            >
              Material{" "}
              {sortConfig?.key === "material"
                ? sortConfig.direction === "asc"
                  ? "▲"
                  : "▼"
                : ""}
            </TableHead>
            <TableHead>Product Type</TableHead>
            <TableHead>Material Categories</TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("testingLaboratory")}
            >
              Testing Lab{" "}
              {sortConfig?.key === "testingLaboratory"
                ? sortConfig.direction === "asc"
                  ? "▲"
                  : "▼"
                : ""}
            </TableHead>
            <TableHead>Approved By</TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("sampleQuantity")}
            >
              Sample Qty{" "}
              {sortConfig?.key === "sampleQuantity"
                ? sortConfig.direction === "asc"
                  ? "▲"
                  : "▼"
                : ""}
            </TableHead>
            <TableHead>Line</TableHead>
            <TableHead>Certification Type</TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("status")}
            >
              Status{" "}
              {sortConfig?.key === "status"
                ? sortConfig.direction === "asc"
                  ? "▲"
                  : "▼"
                : ""}
            </TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead>Est. Due Date</TableHead>
            <TableHead>Paid For By</TableHead>
            <TableHead>Due Date Changes</TableHead>
            <TableHead>Tech. Head</TableHead>
            <TableHead>Plant Head</TableHead>
            <TableHead>Director</TableHead>
            <TableHead>COO</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>

          {/* Filter row */}
          <TableRow>
            <TableCell className="p-1">
              <Input
                placeholder="Filter"
                value={filters.serialNumber || ""}
                onChange={(e) =>
                  setFilters({ ...filters, serialNumber: e.target.value })
                }
                size="sm"
              />
            </TableCell>
            <TableCell className="p-1">
              <Input
                placeholder="Filter"
                value={filters.projectName || ""}
                onChange={(e) =>
                  setFilters({ ...filters, projectName: e.target.value })
                }
                size="sm"
              />
            </TableCell>
            <TableCell className="p-1">
              <Input
                placeholder="Filter"
                value={filters.material || ""}
                onChange={(e) =>
                  setFilters({ ...filters, material: e.target.value })
                }
                size="sm"
              />
            </TableCell>
            <TableCell className="p-1">&nbsp;</TableCell>
            <TableCell className="p-1">&nbsp;</TableCell>
            <TableCell className="p-1">
              <Input
                placeholder="Filter"
                value={filters.testingLaboratory || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    testingLaboratory: e.target.value,
                  })
                }
                size="sm"
              />
            </TableCell>
            <TableCell className="p-1">&nbsp;</TableCell>
            <TableCell className="p-1">
              <Input
                placeholder="Filter"
                value={filters.sampleQuantity || ""}
                onChange={(e) =>
                  setFilters({ ...filters, sampleQuantity: e.target.value })
                }
                size="sm"
              />
            </TableCell>
            <TableCell className="p-1">&nbsp;</TableCell>
            <TableCell className="p-1">&nbsp;</TableCell>
            <TableCell className="p-1">
              <Input
                placeholder="Filter"
                value={filters.status || ""}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
                size="sm"
              />
            </TableCell>
            <TableCell className="p-1">&nbsp;</TableCell>
            <TableCell className="p-1">&nbsp;</TableCell>
            <TableCell className="p-1">&nbsp;</TableCell>
            <TableCell className="p-1">&nbsp;</TableCell>
            <TableCell className="p-1">&nbsp;</TableCell>
            <TableCell className="p-1">&nbsp;</TableCell>
            <TableCell className="p-1">&nbsp;</TableCell>
            <TableCell className="p-1">&nbsp;</TableCell>
          </TableRow>
        </TableHeader>

        <TableBody>
          {displayed.length === 0 ? (
            <TableRow>
              <TableCell colSpan={19} className="text-center py-10 text-gray-500">
                No certifications found.
              </TableCell>
            </TableRow>
          ) : (
            displayed.map((cert) => {
              const bg = getRowBackground(cert);

              // Hide approve buttons if already responded
              const stageKey = user ? roleToStageMap[user.role] : undefined;
              const alreadyResponded =
                stageKey !== undefined &&
                (cert as any)[`${stageKey}Status`] !== "Pending";
              const showApproveActions = canApprove && !alreadyResponded;

              return (
                <TableRow key={cert.id} className={bg}>
                  <TableCell className="font-medium">{cert.serialNumber}</TableCell>
                  <TableCell>{cert.projectName}</TableCell>
                  <TableCell>{cert.material}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {cert.productType.map((type, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-gray-100">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {cert.materialCategories.map((cat, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-gray-100">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{cert.testingLaboratory}</TableCell>
                  <TableCell>{cert.testingApprovedBy || "-"}</TableCell>
                  <TableCell>{cert.sampleQuantity ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {cert.productionLine?.length
                        ? cert.productionLine.map((line, i) => (
                            <Badge key={i} variant="outline" className="text-xs bg-gray-100">
                              {line}
                            </Badge>
                          ))
                        : "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {cert.certificationType}
                    {cert.certificationType === "Customized" && cert.customizationInfo?.customerName && (
                      <div className="text-xs">For: {cert.customizationInfo.customerName}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(cert.status)}>
                      {cert.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(cert.lastUpdatedOn)}</TableCell>
                  <TableCell>{formatDate(cert.dueDate)}</TableCell>
                  <TableCell>
                    {cert.paymentInfo.paidForBy === "Split"
                      ? "Split Payment"
                      : cert.paymentInfo.paidForBy}
                    {cert.paymentInfo.paidForBy === "Supplier" &&
                      cert.paymentInfo.supplierName &&
                      ` – ${cert.paymentInfo.supplierName}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs bg-gray-100">
                      {cert.dueDateHistory?.length ?? 0}
                    </Badge>
                  </TableCell>

                  {/* Approval columns with comments */}
                  <TableCell>
                    <Badge variant="outline" className={getApprovalColor(cert.technicalHeadStatus)}>
                      {cert.technicalHeadStatus}
                    </Badge>
                    {cert.technicalHeadComment && (
                      <div className="text-xs italic text-gray-600">
                        “{cert.technicalHeadComment}”
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getApprovalColor(cert.plantHeadStatus)}>
                      {cert.plantHeadStatus}
                    </Badge>
                    {cert.plantHeadComment && (
                      <div className="text-xs italic text-gray-600">
                        “{cert.plantHeadComment}”
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getApprovalColor(cert.directorStatus)}>
                      {cert.directorStatus}
                    </Badge>
                    {cert.directorComment && (
                      <div className="text-xs italic text-gray-600">
                        “{cert.directorComment}”
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getApprovalColor(cert.cooStatus)}>
                      {cert.cooStatus}
                    </Badge>
                    {cert.cooComment && (
                      <div className="text-xs italic text-gray-600">
                        “{cert.cooComment}”
                      </div>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView(cert)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {user?.role === "Requestor" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(cert)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {showApproveActions && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleApproval(cert, "Approved")}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleApproval(cert, "Rejected")}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
