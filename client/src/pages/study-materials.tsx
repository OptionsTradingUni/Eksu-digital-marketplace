import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search,
  Filter,
  Upload,
  Download,
  Eye,
  Star,
  FileText,
  BookOpen,
  GraduationCap,
  FlaskConical,
  Lightbulb,
  ClipboardList,
  FolderOpen,
  ShoppingCart,
  Check,
  X,
  ChevronRight,
  Loader2,
  Plus,
  Wallet,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { StudyMaterial, User } from "@shared/schema";

type StudyMaterialWithUploader = StudyMaterial & { uploader: User };

const LEVELS = [
  { value: "all", label: "All Levels" },
  { value: "100L", label: "100 Level" },
  { value: "200L", label: "200 Level" },
  { value: "300L", label: "300 Level" },
  { value: "400L", label: "400 Level" },
  { value: "500L", label: "500 Level" },
  { value: "postgraduate", label: "Postgraduate" },
];

const MATERIAL_TYPES = [
  { value: "all", label: "All Types", icon: FolderOpen },
  { value: "past_question", label: "Past Questions", icon: ClipboardList },
  { value: "lecture_note", label: "Lecture Notes", icon: FileText },
  { value: "handout", label: "Handouts", icon: BookOpen },
  { value: "summary", label: "Summaries", icon: Lightbulb },
  { value: "textbook", label: "Textbooks", icon: BookOpen },
  { value: "lab_report", label: "Lab Reports", icon: FlaskConical },
  { value: "project", label: "Projects", icon: GraduationCap },
];

const FACULTIES = [
  { value: "all", label: "All Faculties" },
  { value: "Sciences", label: "Faculty of Sciences" },
  { value: "Arts", label: "Faculty of Arts" },
  { value: "Social Sciences", label: "Faculty of Social Sciences" },
  { value: "Education", label: "Faculty of Education" },
  { value: "Engineering", label: "Faculty of Engineering" },
  { value: "Law", label: "Faculty of Law" },
  { value: "Agriculture", label: "Faculty of Agriculture" },
  { value: "Management Sciences", label: "Faculty of Management Sciences" },
];

function MaterialTypeIcon({ type }: { type: string }) {
  const MaterialIcon = MATERIAL_TYPES.find(t => t.value === type)?.icon || FileText;
  return <MaterialIcon className="h-4 w-4" />;
}

function MaterialCard({ 
  material, 
  onView, 
  onPurchase,
  currentUserId,
}: { 
  material: StudyMaterialWithUploader;
  onView: (material: StudyMaterialWithUploader) => void;
  onPurchase: (material: StudyMaterialWithUploader) => void;
  currentUserId?: string;
}) {
  const isOwner = material.uploaderId === currentUserId;
  const isFree = material.isFree;
  const price = parseFloat(material.price || "0");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        className="overflow-visible cursor-pointer transition-all duration-200" 
        onClick={() => onView(material)}
        data-testid={`card-material-${material.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <MaterialTypeIcon type={material.materialType} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm truncate" data-testid={`text-title-${material.id}`}>
                    {material.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {material.courseCode} {material.courseName && `- ${material.courseName}`}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {isFree ? (
                    <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400">
                      Free
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {"\u20A6"}{price.toLocaleString()}
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {material.level}
                </Badge>
                <Badge variant="outline" className="text-xs gap-1">
                  <MaterialTypeIcon type={material.materialType} />
                  {MATERIAL_TYPES.find(t => t.value === material.materialType)?.label || material.materialType}
                </Badge>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {material.views || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    {material.downloads || 0}
                  </span>
                  {(material.rating && parseFloat(material.rating) > 0) && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      {parseFloat(material.rating).toFixed(1)}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {material.createdAt && formatDistanceToNow(new Date(material.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function MaterialCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="w-12 h-12 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2 mb-2" />
            <div className="flex gap-2 mb-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UploadMaterialDialog({ 
  open, 
  onOpenChange, 
  onSuccess 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  
  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);
  
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    courseCode: "",
    courseName: "",
    faculty: "",
    department: "",
    level: "100L",
    materialType: "past_question",
    semester: "",
    academicYear: "",
    price: "0",
    isFree: true,
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch("/api/study-materials", {
        method: "POST",
        body: data,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Material uploaded successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/study-materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/study-materials/my-uploads"] });
      onSuccess();
      onOpenChange(false);
      setFile(null);
      setFormData({
        title: "",
        description: "",
        courseCode: "",
        courseName: "",
        faculty: "",
        department: "",
        level: "100L",
        materialType: "past_question",
        semester: "",
        academicYear: "",
        price: "0",
        isFree: true,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!file) {
      toast({ title: "Error", description: "Please select a file to upload", variant: "destructive" });
      return;
    }
    if (!formData.title.trim()) {
      toast({ title: "Error", description: "Please enter a title", variant: "destructive" });
      return;
    }
    if (!formData.courseCode.trim()) {
      toast({ title: "Error", description: "Please enter a course code", variant: "destructive" });
      return;
    }

    const data = new FormData();
    data.append("file", file);
    data.append("title", formData.title);
    data.append("description", formData.description);
    data.append("courseCode", formData.courseCode.toUpperCase());
    data.append("courseName", formData.courseName);
    data.append("faculty", formData.faculty);
    data.append("department", formData.department);
    data.append("level", formData.level);
    data.append("materialType", formData.materialType);
    data.append("semester", formData.semester);
    data.append("academicYear", formData.academicYear);
    data.append("price", formData.isFree ? "0" : formData.price);
    data.append("isFree", String(formData.isFree));

    uploadMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Study Material</DialogTitle>
          <DialogDescription>
            Share your study materials with fellow students. You can set a price or make it free.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">File (Documents, Images, Videos)</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.mkv,.webm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              data-testid="input-file"
            />
            {file && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
                {file.type.startsWith('image/') && previewUrl && (
                  <div className="relative w-full h-32 rounded-md overflow-hidden bg-muted">
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                {file.type.startsWith('video/') && previewUrl && (
                  <div className="relative w-full rounded-md overflow-hidden bg-muted">
                    <video 
                      src={previewUrl} 
                      controls 
                      className="w-full max-h-40"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., CSC 201 Past Questions 2023"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              data-testid="input-title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="courseCode">Course Code *</Label>
              <Input
                id="courseCode"
                placeholder="e.g., CSC 201"
                value={formData.courseCode}
                onChange={(e) => setFormData(prev => ({ ...prev, courseCode: e.target.value }))}
                data-testid="input-course-code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="courseName">Course Name</Label>
              <Input
                id="courseName"
                placeholder="e.g., Data Structures"
                value={formData.courseName}
                onChange={(e) => setFormData(prev => ({ ...prev, courseName: e.target.value }))}
                data-testid="input-course-name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="level">Level *</Label>
              <Select
                value={formData.level}
                onValueChange={(value) => setFormData(prev => ({ ...prev, level: value }))}
              >
                <SelectTrigger data-testid="select-level">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.filter(l => l.value !== "all").map(level => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="materialType">Type *</Label>
              <Select
                value={formData.materialType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, materialType: value }))}
              >
                <SelectTrigger data-testid="select-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_TYPES.filter(t => t.value !== "all").map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="faculty">Faculty</Label>
            <Select
              value={formData.faculty}
              onValueChange={(value) => setFormData(prev => ({ ...prev, faculty: value }))}
            >
              <SelectTrigger data-testid="select-faculty">
                <SelectValue placeholder="Select faculty" />
              </SelectTrigger>
              <SelectContent>
                {FACULTIES.filter(f => f.value !== "all").map(faculty => (
                  <SelectItem key={faculty.value} value={faculty.value}>
                    {faculty.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the material..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              data-testid="input-description"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Switch
                id="isFree"
                checked={formData.isFree}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isFree: checked }))}
                data-testid="switch-free"
              />
              <Label htmlFor="isFree">Make it free</Label>
            </div>
            {!formData.isFree && (
              <div className="flex items-center gap-2">
                <span className="text-sm">{"\u20A6"}</span>
                <Input
                  type="number"
                  min="0"
                  step="50"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  className="w-24"
                  data-testid="input-price"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={uploadMutation.isPending}
            data-testid="button-upload-submit"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Material
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaterialDetailDialog({ 
  material, 
  open, 
  onOpenChange,
  onPurchase,
  onDownload,
  currentUserId,
}: { 
  material: StudyMaterialWithUploader | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurchase: (material: StudyMaterialWithUploader) => void;
  onDownload: (material: StudyMaterialWithUploader) => void;
  currentUserId?: string;
}) {
  const { data: walletData } = useQuery<{ balance: string }>({
    queryKey: ["/api/wallet"],
  });

  const { data: detailData } = useQuery<StudyMaterialWithUploader & { hasPurchased: boolean }>({
    queryKey: ["/api/study-materials", material?.id],
    enabled: !!material?.id && open,
  });

  if (!material) return null;

  const isOwner = material.uploaderId === currentUserId;
  const isFree = material.isFree;
  const hasPurchased = detailData?.hasPurchased || false;
  const canAccess = isOwner || hasPurchased || isFree;
  const price = parseFloat(material.price || "0");
  const walletBalance = parseFloat(walletData?.balance || "0");
  const canAfford = walletBalance >= price;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MaterialTypeIcon type={material.materialType} />
            {material.title}
          </DialogTitle>
          <DialogDescription>
            {material.courseCode} {material.courseName && `- ${material.courseName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{material.level}</Badge>
            <Badge variant="outline" className="gap-1">
              <MaterialTypeIcon type={material.materialType} />
              {MATERIAL_TYPES.find(t => t.value === material.materialType)?.label}
            </Badge>
            {material.faculty && (
              <Badge variant="outline">{material.faculty}</Badge>
            )}
            {isFree ? (
              <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">Free</Badge>
            ) : (
              <Badge className="bg-primary/10 text-primary">{"\u20A6"}{price.toLocaleString()}</Badge>
            )}
          </div>

          {material.description && (
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm">{material.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span>{material.views || 0} views</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Download className="h-4 w-4" />
              <span>{material.downloads || 0} downloads</span>
            </div>
            {material.rating && parseFloat(material.rating) > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                <span>{parseFloat(material.rating).toFixed(1)} ({material.ratingCount} ratings)</span>
              </div>
            )}
            {material.fileSize && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{(material.fileSize / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Uploaded by</span>
            <span className="font-medium text-foreground">
              {material.uploader.firstName} {material.uploader.lastName}
            </span>
            <span>
              {material.createdAt && formatDistanceToNow(new Date(material.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {canAccess ? (
            <Button onClick={() => onDownload(material)} className="w-full sm:w-auto" data-testid="button-download">
              <Download className="mr-2 h-4 w-4" />
              Download Material
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground w-full sm:w-auto">
                <Wallet className="h-4 w-4" />
                <span>Balance: {"\u20A6"}{walletBalance.toLocaleString()}</span>
              </div>
              <Button 
                onClick={() => onPurchase(material)} 
                disabled={!canAfford}
                className="w-full sm:w-auto"
                data-testid="button-purchase"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {canAfford ? `Purchase for \u20A6${price.toLocaleString()}` : "Insufficient Balance"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterSidebar({
  filters,
  onFilterChange,
  onReset,
}: {
  filters: { level: string; faculty: string; materialType: string };
  onFilterChange: (key: string, value: string) => void;
  onReset: () => void;
}) {
  const hasFilters = filters.level !== "all" || filters.faculty !== "all" || filters.materialType !== "all";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Filters</h3>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onReset} data-testid="button-reset-filters">
            Reset
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Level</Label>
          <Select value={filters.level} onValueChange={(v) => onFilterChange("level", v)}>
            <SelectTrigger data-testid="filter-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map(level => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Faculty</Label>
          <Select value={filters.faculty} onValueChange={(v) => onFilterChange("faculty", v)}>
            <SelectTrigger data-testid="filter-faculty">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FACULTIES.map(faculty => (
                <SelectItem key={faculty.value} value={faculty.value}>
                  {faculty.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Material Type</Label>
          <Select value={filters.materialType} onValueChange={(v) => onFilterChange("materialType", v)}>
            <SelectTrigger data-testid="filter-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  <span className="flex items-center gap-2">
                    <type.icon className="h-4 w-4" />
                    {type.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export default function StudyMaterialsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    level: "all",
    faculty: "all",
    materialType: "all",
  });
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterialWithUploader | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (filters.level !== "all") params.set("level", filters.level);
    if (filters.faculty !== "all") params.set("faculty", filters.faculty);
    if (filters.materialType !== "all") params.set("materialType", filters.materialType);
    return params.toString();
  };

  const { data: materials, isLoading } = useQuery<StudyMaterialWithUploader[]>({
    queryKey: ["/api/study-materials", buildQueryParams()],
  });

  const purchaseMutation = useMutation({
    mutationFn: async (materialId: string) => {
      const res = await apiRequest("POST", `/api/study-materials/${materialId}/purchase`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Material purchased successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/study-materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      setDetailDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Purchase Failed", description: error.message, variant: "destructive" });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (materialId: string) => {
      const res = await apiRequest("GET", `/api/study-materials/${materialId}/download`);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
        toast({ title: "Success", description: "Download started!" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Download Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleViewMaterial = (material: StudyMaterialWithUploader) => {
    setSelectedMaterial(material);
    setDetailDialogOpen(true);
  };

  const handlePurchase = (material: StudyMaterialWithUploader) => {
    purchaseMutation.mutate(material.id);
  };

  const handleDownload = (material: StudyMaterialWithUploader) => {
    downloadMutation.mutate(material.id);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({ level: "all", faculty: "all", materialType: "all" });
    setSearchQuery("");
  };

  const hasActiveFilters = filters.level !== "all" || filters.faculty !== "all" || filters.materialType !== "all" || searchQuery;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <Card className="sticky top-20">
              <CardContent className="p-4">
                <FilterSidebar
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  onReset={handleResetFilters}
                />
              </CardContent>
            </Card>
          </aside>

          <main className="flex-1">
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">Study Materials</h1>
                  <p className="text-muted-foreground text-sm">Past questions, notes, and more from fellow students</p>
                </div>
                <Button onClick={() => setUploadDialogOpen(true)} data-testid="button-upload">
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Upload Material</span>
                  <span className="sm:hidden">Upload</span>
                </Button>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by title or course code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
                <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="lg:hidden" data-testid="button-mobile-filter">
                      <Filter className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right">
                    <SheetHeader>
                      <SheetTitle>Filter Materials</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <FilterSidebar
                        filters={filters}
                        onFilterChange={(key, value) => {
                          handleFilterChange(key, value);
                        }}
                        onReset={() => {
                          handleResetFilters();
                          setMobileFilterOpen(false);
                        }}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Active filters:</span>
                  {filters.level !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      {LEVELS.find(l => l.value === filters.level)?.label}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => handleFilterChange("level", "all")} 
                      />
                    </Badge>
                  )}
                  {filters.faculty !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      {filters.faculty}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => handleFilterChange("faculty", "all")} 
                      />
                    </Badge>
                  )}
                  {filters.materialType !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      {MATERIAL_TYPES.find(t => t.value === filters.materialType)?.label}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => handleFilterChange("materialType", "all")} 
                      />
                    </Badge>
                  )}
                  {searchQuery && (
                    <Badge variant="secondary" className="gap-1">
                      Search: {searchQuery}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => setSearchQuery("")} 
                      />
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <MaterialCardSkeleton key={i} />
                ))}
              </div>
            ) : materials && materials.length > 0 ? (
              <AnimatePresence mode="popLayout">
                <div className="space-y-4">
                  {materials.map(material => (
                    <MaterialCard
                      key={material.id}
                      material={material}
                      onView={handleViewMaterial}
                      onPurchase={handlePurchase}
                      currentUserId={user?.id}
                    />
                  ))}
                </div>
              </AnimatePresence>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No materials found</h3>
                  <p className="text-muted-foreground text-sm text-center mb-4">
                    {hasActiveFilters
                      ? "Try adjusting your filters or search query"
                      : "Be the first to upload study materials!"}
                  </p>
                  <Button onClick={() => setUploadDialogOpen(true)} data-testid="button-upload-empty">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Material
                  </Button>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>

      <UploadMaterialDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={() => {}}
      />

      <MaterialDetailDialog
        material={selectedMaterial}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onPurchase={handlePurchase}
        onDownload={handleDownload}
        currentUserId={user?.id}
      />
    </div>
  );
}
