import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search,
  Filter,
  Home,
  MapPin,
  Bed,
  Bath,
  Eye,
  Plus,
  Loader2,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Wifi,
  Zap,
  Droplets,
  Shield,
  Car,
  Building2,
  ImageIcon,
  Phone,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Hostel, User } from "@shared/schema";
import { Link } from "wouter";

type HostelWithAgent = Hostel & { agent: User };

const LOCATIONS = [
  { value: "all", label: "All Locations" },
  { value: "Campus Gate", label: "Campus Gate" },
  { value: "Oke-Oja", label: "Oke-Oja" },
  { value: "Temidire", label: "Temidire" },
  { value: "Iworoko Road", label: "Iworoko Road" },
  { value: "Basiri", label: "Basiri" },
  { value: "Ajilosun", label: "Ajilosun" },
  { value: "Adebayo", label: "Adebayo" },
  { value: "Fajuyi", label: "Fajuyi" },
  { value: "Stadium Road", label: "Stadium Road" },
  { value: "NTA Road", label: "NTA Road" },
  { value: "Ijigbo", label: "Ijigbo" },
  { value: "Oroke", label: "Oroke" },
];

const BEDROOMS = [
  { value: "all", label: "Any Rooms" },
  { value: "1", label: "1 Bedroom (Self-contain)" },
  { value: "2", label: "2 Bedrooms" },
  { value: "3", label: "3 Bedrooms" },
  { value: "4", label: "4+ Bedrooms" },
];

const AMENITIES = [
  { value: "wifi", label: "WiFi", icon: Wifi },
  { value: "electricity", label: "24/7 Electricity", icon: Zap },
  { value: "water", label: "Running Water", icon: Droplets },
  { value: "security", label: "Security", icon: Shield },
  { value: "parking", label: "Parking Space", icon: Car },
  { value: "tiles", label: "Tiled Floor", icon: Building2 },
  { value: "wardrobe", label: "Wardrobe", icon: Building2 },
  { value: "kitchen", label: "Kitchen", icon: Building2 },
  { value: "bathroom_ensuite", label: "Ensuite Bathroom", icon: Bath },
  { value: "borehole", label: "Borehole", icon: Droplets },
  { value: "generator", label: "Generator", icon: Zap },
  { value: "prepaid_meter", label: "Prepaid Meter", icon: Zap },
];

function getAmenityIcon(amenity: string) {
  const found = AMENITIES.find(a => a.value === amenity);
  return found?.icon || Building2;
}

function HostelCard({ 
  hostel, 
  onView, 
}: { 
  hostel: Hostel;
  onView: (hostel: Hostel) => void;
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = hostel.images || [];
  const hasImages = images.length > 0;
  const price = parseFloat(hostel.price || "0");

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        className="overflow-visible cursor-pointer transition-all duration-200" 
        onClick={() => onView(hostel)}
        data-testid={`card-hostel-${hostel.id}`}
      >
        <div className="relative aspect-[4/3] bg-muted rounded-t-lg overflow-hidden">
          {hasImages ? (
            <>
              <img 
                src={images[currentImageIndex]} 
                alt={hostel.title}
                className="w-full h-full object-cover"
              />
              {images.length > 1 && (
                <>
                  <Button 
                    size="icon" 
                    variant="secondary"
                    className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="secondary"
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                    onClick={nextImage}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {images.map((_, idx) => (
                      <div 
                        key={idx}
                        className={`w-1.5 h-1.5 rounded-full ${idx === currentImageIndex ? 'bg-white' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}
          <Badge className="absolute top-2 right-2 bg-background/90 text-foreground">
            {"\u20A6"}{price.toLocaleString()}/yr
          </Badge>
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm truncate" data-testid={`text-title-${hostel.id}`}>
            {hostel.title}
          </h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{hostel.location}</span>
          </div>
          
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            {hostel.bedrooms && (
              <span className="flex items-center gap-1">
                <Bed className="h-3 w-3" />
                {hostel.bedrooms} {hostel.bedrooms === 1 ? 'Bed' : 'Beds'}
              </span>
            )}
            {hostel.bathrooms && (
              <span className="flex items-center gap-1">
                <Bath className="h-3 w-3" />
                {hostel.bathrooms} {hostel.bathrooms === 1 ? 'Bath' : 'Baths'}
              </span>
            )}
            <span className="flex items-center gap-1 ml-auto">
              <Eye className="h-3 w-3" />
              {hostel.views || 0}
            </span>
          </div>

          {hostel.amenities && hostel.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {hostel.amenities.slice(0, 3).map((amenity) => (
                <Badge key={amenity} variant="outline" className="text-xs">
                  {AMENITIES.find(a => a.value === amenity)?.label || amenity}
                </Badge>
              ))}
              {hostel.amenities.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{hostel.amenities.length - 3} more
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function HostelCardSkeleton() {
  return (
    <Card>
      <Skeleton className="aspect-[4/3] rounded-t-lg" />
      <CardContent className="p-4">
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-3 w-1/2 mb-3" />
        <div className="flex gap-4 mb-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-12" />
        </div>
      </CardContent>
    </Card>
  );
}

function CreateHostelDialog({ 
  open, 
  onOpenChange, 
  onSuccess 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [images, setImages] = useState<File[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    address: "",
    price: "",
    bedrooms: "1",
    bathrooms: "1",
    distanceFromCampus: "",
    agentFee: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch("/api/hostels", {
        method: "POST",
        body: data,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create listing");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Hostel listing created successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/hostels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hostels/my-listings"] });
      onSuccess();
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setImages([]);
    setSelectedAmenities([]);
    setFormData({
      title: "",
      description: "",
      location: "",
      address: "",
      price: "",
      bedrooms: "1",
      bathrooms: "1",
      distanceFromCampus: "",
      agentFee: "",
    });
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast({ title: "Error", description: "Please enter a title", variant: "destructive" });
      return;
    }
    if (!formData.description.trim()) {
      toast({ title: "Error", description: "Please enter a description", variant: "destructive" });
      return;
    }
    if (!formData.location) {
      toast({ title: "Error", description: "Please select a location", variant: "destructive" });
      return;
    }
    if (!formData.price.trim()) {
      toast({ title: "Error", description: "Please enter a price", variant: "destructive" });
      return;
    }

    const data = new FormData();
    images.forEach((image) => {
      data.append("images", image);
    });
    data.append("title", formData.title);
    data.append("description", formData.description);
    data.append("location", formData.location);
    data.append("address", formData.address);
    data.append("price", formData.price);
    data.append("bedrooms", formData.bedrooms);
    data.append("bathrooms", formData.bathrooms);
    data.append("distanceFromCampus", formData.distanceFromCampus);
    data.append("agentFee", formData.agentFee);
    data.append("amenities", JSON.stringify(selectedAmenities));

    createMutation.mutate(data);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files);
      if (images.length + newImages.length > 10) {
        toast({ title: "Error", description: "Maximum 10 images allowed", variant: "destructive" });
        return;
      }
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenity) 
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>List Your Hostel</DialogTitle>
          <DialogDescription>
            Add your hostel or apartment to help students find accommodation near EKSU.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="images">Photos (up to 10)</Label>
            <Input
              id="images"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              data-testid="input-images"
            />
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {images.map((image, idx) => (
                  <div key={idx} className="relative aspect-square rounded-md overflow-hidden">
                    <img 
                      src={URL.createObjectURL(image)} 
                      alt={`Preview ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-5 w-5"
                      onClick={() => removeImage(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Spacious 2-Bedroom Apartment at Campus Gate"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              data-testid="input-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the hostel, its features, and what makes it special..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              data-testid="input-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Select
                value={formData.location}
                onValueChange={(value) => setFormData(prev => ({ ...prev, location: value }))}
              >
                <SelectTrigger data-testid="select-location">
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATIONS.filter(l => l.value !== "all").map(loc => (
                    <SelectItem key={loc.value} value={loc.value}>
                      {loc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price per Year ({"\u20A6"}) *</Label>
              <Input
                id="price"
                type="number"
                placeholder="e.g., 150000"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                data-testid="input-price"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Full Address</Label>
            <Input
              id="address"
              placeholder="e.g., No. 5, Abiodun Street, Campus Gate"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              data-testid="input-address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bedrooms">Bedrooms</Label>
              <Select
                value={formData.bedrooms}
                onValueChange={(value) => setFormData(prev => ({ ...prev, bedrooms: value }))}
              >
                <SelectTrigger data-testid="select-bedrooms">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 (Self-contain)</SelectItem>
                  <SelectItem value="2">2 Bedrooms</SelectItem>
                  <SelectItem value="3">3 Bedrooms</SelectItem>
                  <SelectItem value="4">4+ Bedrooms</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bathrooms">Bathrooms</Label>
              <Select
                value={formData.bathrooms}
                onValueChange={(value) => setFormData(prev => ({ ...prev, bathrooms: value }))}
              >
                <SelectTrigger data-testid="select-bathrooms">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Bathroom</SelectItem>
                  <SelectItem value="2">2 Bathrooms</SelectItem>
                  <SelectItem value="3">3+ Bathrooms</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="distance">Distance from Campus (km)</Label>
              <Input
                id="distance"
                type="number"
                step="0.1"
                placeholder="e.g., 0.5"
                value={formData.distanceFromCampus}
                onChange={(e) => setFormData(prev => ({ ...prev, distanceFromCampus: e.target.value }))}
                data-testid="input-distance"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agentFee">Agent Fee ({"\u20A6"})</Label>
              <Input
                id="agentFee"
                type="number"
                placeholder="e.g., 10000"
                value={formData.agentFee}
                onChange={(e) => setFormData(prev => ({ ...prev, agentFee: e.target.value }))}
                data-testid="input-agent-fee"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Amenities</Label>
            <div className="grid grid-cols-2 gap-2">
              {AMENITIES.map((amenity) => (
                <div key={amenity.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={amenity.value}
                    checked={selectedAmenities.includes(amenity.value)}
                    onCheckedChange={() => toggleAmenity(amenity.value)}
                    data-testid={`checkbox-amenity-${amenity.value}`}
                  />
                  <label
                    htmlFor={amenity.value}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {amenity.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createMutation.isPending}
            data-testid="button-create-submit"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Listing
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HostelDetailDialog({ 
  hostel, 
  open, 
  onOpenChange,
}: { 
  hostel: Hostel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { data: hostelWithAgent } = useQuery<HostelWithAgent>({
    queryKey: ["/api/hostels", hostel?.id],
    enabled: !!hostel?.id && open,
  });

  if (!hostel) return null;

  const images = hostel.images || [];
  const price = parseFloat(hostel.price || "0");
  const agentFee = parseFloat(hostel.agentFee || "0");
  const agent = hostelWithAgent?.agent;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            {hostel.title}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {hostel.location}{hostel.address && ` - ${hostel.address}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {images.length > 0 && (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              <img 
                src={images[currentImageIndex]} 
                alt={`${hostel.title} - Image ${currentImageIndex + 1}`}
                className="w-full h-full object-cover"
              />
              {images.length > 1 && (
                <>
                  <Button 
                    size="icon" 
                    variant="secondary"
                    className="absolute left-2 top-1/2 -translate-y-1/2"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="secondary"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={nextImage}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-white' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge className="bg-primary/10 text-primary text-lg px-3 py-1">
              {"\u20A6"}{price.toLocaleString()}/yr
            </Badge>
            {hostel.bedrooms && (
              <Badge variant="outline" className="gap-1">
                <Bed className="h-3 w-3" />
                {hostel.bedrooms} {hostel.bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}
              </Badge>
            )}
            {hostel.bathrooms && (
              <Badge variant="outline" className="gap-1">
                <Bath className="h-3 w-3" />
                {hostel.bathrooms} {hostel.bathrooms === 1 ? 'Bathroom' : 'Bathrooms'}
              </Badge>
            )}
            {hostel.distanceFromCampus && (
              <Badge variant="outline" className="gap-1">
                <MapPin className="h-3 w-3" />
                {hostel.distanceFromCampus}km from campus
              </Badge>
            )}
            {hostel.isAvailable ? (
              <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">
                Available
              </Badge>
            ) : (
              <Badge variant="secondary">
                Not Available
              </Badge>
            )}
          </div>

          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm whitespace-pre-wrap">{hostel.description}</p>
          </div>

          {hostel.amenities && hostel.amenities.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Amenities</h4>
              <div className="flex flex-wrap gap-2">
                {hostel.amenities.map((amenity) => {
                  const AmenityIcon = getAmenityIcon(amenity);
                  return (
                    <Badge key={amenity} variant="outline" className="gap-1">
                      <AmenityIcon className="h-3 w-3" />
                      {AMENITIES.find(a => a.value === amenity)?.label || amenity}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            {agentFee > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Agent Fee:</span>
                <span className="font-medium text-foreground">{"\u20A6"}{agentFee.toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span>{hostel.views || 0} views</span>
            </div>
            {hostel.createdAt && (
              <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                <span>Listed {formatDistanceToNow(new Date(hostel.createdAt), { addSuffix: true })}</span>
              </div>
            )}
          </div>

          {agent && (
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium text-sm mb-3">Agent / Landlord</h4>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  {agent.profileImageUrl ? (
                    <img src={agent.profileImageUrl} alt={agent.firstName || ''} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-lg font-semibold">
                      {agent.firstName?.[0]}{agent.lastName?.[0]}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{agent.firstName} {agent.lastName}</p>
                  {agent.phoneNumber && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {agent.phoneNumber}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {agent && (
            <Link href={`/messages/${agent.id}`} className="w-full sm:w-auto">
              <Button className="w-full" data-testid="button-contact-agent">
                <MessageCircle className="mr-2 h-4 w-4" />
                Contact Agent
              </Button>
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FiltersPanel({ 
  filters, 
  onFilterChange,
  onReset,
}: { 
  filters: {
    location: string;
    bedrooms: string;
    priceRange: number[];
  };
  onFilterChange: (key: string, value: any) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6 p-4">
      <div className="space-y-2">
        <Label>Location</Label>
        <Select
          value={filters.location}
          onValueChange={(value) => onFilterChange("location", value)}
        >
          <SelectTrigger data-testid="filter-location">
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {LOCATIONS.map(loc => (
              <SelectItem key={loc.value} value={loc.value}>
                {loc.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Bedrooms</Label>
        <Select
          value={filters.bedrooms}
          onValueChange={(value) => onFilterChange("bedrooms", value)}
        >
          <SelectTrigger data-testid="filter-bedrooms">
            <SelectValue placeholder="Select rooms" />
          </SelectTrigger>
          <SelectContent>
            {BEDROOMS.map(room => (
              <SelectItem key={room.value} value={room.value}>
                {room.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Price Range (yearly)</Label>
          <span className="text-sm text-muted-foreground">
            {"\u20A6"}{filters.priceRange[0].toLocaleString()} - {"\u20A6"}{filters.priceRange[1].toLocaleString()}
          </span>
        </div>
        <Slider
          value={filters.priceRange}
          min={0}
          max={500000}
          step={10000}
          onValueChange={(value) => onFilterChange("priceRange", value)}
          data-testid="filter-price-range"
        />
      </div>

      <Button variant="outline" className="w-full" onClick={onReset} data-testid="button-reset-filters">
        Reset Filters
      </Button>
    </div>
  );
}

export default function HostelsPage() {
  const { user, isEmailVerified } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedHostel, setSelectedHostel] = useState<Hostel | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [showMyListings, setShowMyListings] = useState(false);
  const [filters, setFilters] = useState({
    location: "all",
    bedrooms: "all",
    priceRange: [0, 500000] as number[],
  });

  // Fetch all hostels
  const { data: hostels, isLoading: hostelsLoading } = useQuery<Hostel[]>({
    queryKey: ["/api/hostels", { 
      search: searchQuery,
      location: filters.location !== "all" ? filters.location : undefined,
      bedrooms: filters.bedrooms !== "all" ? filters.bedrooms : undefined,
      minPrice: filters.priceRange[0] > 0 ? filters.priceRange[0] : undefined,
      maxPrice: filters.priceRange[1] < 500000 ? filters.priceRange[1] : undefined,
    }],
  });

  // Fetch user's hostels
  const { data: myHostels, isLoading: myHostelsLoading } = useQuery<Hostel[]>({
    queryKey: ["/api/hostels/my-listings"],
    enabled: !!user && showMyListings,
  });

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      location: "all",
      bedrooms: "all",
      priceRange: [0, 500000],
    });
    setSearchQuery("");
  };

  const handleViewHostel = (hostel: Hostel) => {
    setSelectedHostel(hostel);
    setDetailDialogOpen(true);
  };

  const handleCreateClick = () => {
    if (!isEmailVerified) {
      toast({
        title: "Email Verification Required",
        description: "Please verify your email before listing a hostel.",
        variant: "destructive",
      });
      return;
    }
    setCreateDialogOpen(true);
  };

  const displayedHostels = showMyListings ? myHostels : hostels;
  const isLoading = showMyListings ? myHostelsLoading : hostelsLoading;

  // Apply client-side price filtering
  const filteredHostels = displayedHostels?.filter(hostel => {
    const price = parseFloat(hostel.price || "0");
    return price >= filters.priceRange[0] && price <= filters.priceRange[1];
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Home className="h-6 w-6" />
              Hostel Finder
            </h1>
            <p className="text-sm text-muted-foreground">
              Find your perfect accommodation near EKSU
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showMyListings ? "default" : "outline"}
              onClick={() => setShowMyListings(!showMyListings)}
              data-testid="button-toggle-my-listings"
            >
              {showMyListings ? "All Hostels" : "My Listings"}
            </Button>
            <Button onClick={handleCreateClick} data-testid="button-list-hostel">
              <Plus className="mr-2 h-4 w-4" />
              List Hostel
            </Button>
          </div>
        </div>

        <div className="flex gap-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="lg:hidden" data-testid="button-open-filters">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <FiltersPanel 
                filters={filters} 
                onFilterChange={handleFilterChange}
                onReset={resetFilters}
              />
            </SheetContent>
          </Sheet>

          <aside className="hidden lg:block w-64 flex-shrink-0">
            <Card className="sticky top-4">
              <CardContent className="p-0">
                <div className="p-4 border-b">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                  </h3>
                </div>
                <FiltersPanel 
                  filters={filters} 
                  onFilterChange={handleFilterChange}
                  onReset={resetFilters}
                />
              </CardContent>
            </Card>
          </aside>

          <div className="flex-1">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <HostelCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredHostels && filteredHostels.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  {filteredHostels.length} hostel{filteredHostels.length !== 1 ? 's' : ''} found
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AnimatePresence mode="popLayout">
                    {filteredHostels.map(hostel => (
                      <HostelCard
                        key={hostel.id}
                        hostel={hostel}
                        onView={handleViewHostel}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <Card className="p-8 text-center">
                <Home className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold mb-2">
                  {showMyListings ? "No listings yet" : "No hostels found"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {showMyListings 
                    ? "You haven't listed any hostels yet. Click the button above to list your first property."
                    : "Try adjusting your filters or search query."}
                </p>
                {showMyListings && (
                  <Button onClick={handleCreateClick} data-testid="button-create-first">
                    <Plus className="mr-2 h-4 w-4" />
                    List Your First Hostel
                  </Button>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>

      <CreateHostelDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {}}
      />

      <HostelDetailDialog
        hostel={selectedHostel}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
}
