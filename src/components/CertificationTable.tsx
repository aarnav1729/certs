
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
import { Eye, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Certification } from "@/lib/types";
import { deleteCertification } from "@/lib/storage";
import { toast } from "sonner";

interface CertificationTableProps {
  certifications: Certification[];
  onEdit: (certification: Certification) => void;
  onView: (certification: Certification) => void;
  onDelete: (id: string) => void;
  onDataChange: () => void;
}

export function CertificationTable({ 
  certifications, 
  onEdit, 
  onView, 
  onDelete,
  onDataChange 
}: CertificationTableProps) {
  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this certification?')) {
      const success = deleteCertification(id);
      if (success) {
        toast.success('Certification deleted successfully');
        onDelete(id);
        onDataChange();
      } else {
        toast.error('Failed to delete certification');
      }
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy');
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-[80px]">S/N</TableHead>
            <TableHead>Project Name</TableHead>
            <TableHead>Product Type</TableHead>
            <TableHead>Testing Lab</TableHead>
            <TableHead>PIC</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Update On</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {certifications.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                No certifications found. Create a new one to get started.
              </TableCell>
            </TableRow>
          ) : (
            certifications.map((certification) => (
              <TableRow key={certification.id}>
                <TableCell className="font-medium">
                  {certification.serialNumber}
                </TableCell>
                <TableCell>{certification.projectName}</TableCell>
                <TableCell>{certification.productType}</TableCell>
                <TableCell>{certification.testingLaboratory}</TableCell>
                <TableCell>{certification.pic}</TableCell>
                <TableCell>
                  <Badge 
                    variant="outline"
                    className={
                      certification.status === 'Complete' 
                        ? 'bg-status-complete text-white border-status-complete'
                        : 'bg-status-inprogress text-white border-status-inprogress'
                    }
                  >
                    {certification.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(certification.updateOn)}</TableCell>
                <TableCell>{formatDate(certification.dueDate)}</TableCell>
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
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDelete(certification.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
