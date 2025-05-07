import { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit } from "lucide-react";
import { format } from "date-fns";
import { Certification } from "@/lib/types";

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
  onDataChange 
}: CertificationTableProps) {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy');
    } catch (e) {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Not Started Yet':
        return 'bg-gray-500 text-white border-gray-500';
      case 'In Progress':
        return 'bg-status-inprogress text-white border-status-inprogress';
      case 'Completed':
        return 'bg-status-complete text-white border-status-complete';
      default:
        return 'bg-gray-500 text-white border-gray-500';
    }
  };

  const isOverdue = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    return due < now;
  };

  return (
    <div className="rounded-md border bg-white overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-[80px]">S/N</TableHead>
            <TableHead>Project Name</TableHead>
            <TableHead>Material</TableHead>
            <TableHead>Product Type</TableHead>
            <TableHead>Material Categories</TableHead>
            <TableHead>Testing Lab</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Paid For By</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {certifications.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-10 text-gray-500">
                No certifications found. Create a new one to get started.
              </TableCell>
            </TableRow>
          ) : (
            certifications.map((certification) => {
              const overdue = isOverdue(certification.dueDate) && certification.status !== 'Completed';
              
              return (
                <TableRow 
                  key={certification.id}
                  className={overdue ? "bg-red-50" : ""}
                >
                  <TableCell className="font-medium">
                    {certification.serialNumber}
                  </TableCell>
                  <TableCell>{certification.projectName}</TableCell>
                  <TableCell>
                    {certification.material}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(certification.productType) ? (
                        certification.productType.map((type, idx) => (
                          <Badge 
                            key={idx} 
                            variant="outline" 
                            className="text-xs bg-gray-100"
                          >
                            {type}
                          </Badge>
                        ))
                      ) : (
                        // Handle legacy format (for backward compatibility)
                        <Badge 
                          variant="outline" 
                          className="text-xs bg-gray-100"
                        >
                          {certification.productType}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {certification.materialCategories.map((category, idx) => (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className="text-xs bg-gray-100"
                        >
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{certification.testingLaboratory}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline"
                      className={getStatusColor(certification.status)}
                    >
                      {certification.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(certification.lastUpdatedOn)}</TableCell>
                  <TableCell className={overdue ? "text-red-600 font-medium" : ""}>
                    {formatDate(certification.dueDate)}
                  </TableCell>
                  <TableCell>
                    {certification.paymentInfo.paidForBy}
                    {certification.paymentInfo.paidForBy === 'Supplier' && 
                      certification.paymentInfo.supplierName && 
                      ` - ${certification.paymentInfo.supplierName}`
                    }
                  </TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onView(certification)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onEdit(certification)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
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
