import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import { insertProductSchema, type InsertProduct, type Category, type Product } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, X, Loader2, MapPin, Tag, Shield, AlertTriangle } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

const EKSU_LOCATIONS = [
  { value: "school_gate", label: "School Gate" },
  { value: "town", label: "Town" },
  { value: "yemkem", label: "Yemkem" },
  { value: "iworoko", label: "Iworoko" },
  { value: "phase2", label: "Phase2" },
  { value: "osekita", label: "Osekita" },
];

export default function CreateProduct() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isVerified, isSeller } = useAuth();
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  
  const isEditMode = !!id;
  
  // Check if user can create listings (must be verified seller)
  const canCreateListing = isVerified && isSeller;

  // Fetch categories
  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch existing product when editing
  const { data: existingProduct, isLoading: isLoadingProduct } = useQuery<Product>({
    queryKey: ["/api/products", id],
    enabled: isEditMode,
  });

  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      title: "",
      description: "",
      price: "0",
      originalPrice: "",
      isOnSale: false,
      categoryId: "",
      condition: "good",
      location: "",
      images: [],
      isAvailable: true,
      isFeatured: false,
      isBoosted: false,
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (existingProduct && isEditMode) {
      form.reset({
        title: existingProduct.title,
        description: existingProduct.description,
        price: String(existingProduct.price),
        originalPrice: existingProduct.originalPrice ? String(existingProduct.originalPrice) : "",
        isOnSale: existingProduct.isOnSale ?? false,
        categoryId: existingProduct.categoryId,
        condition: existingProduct.condition,
        location: existingProduct.location || "",
        images: existingProduct.images || [],
        isAvailable: existingProduct.isAvailable ?? true,
        isFeatured: existingProduct.isFeatured ?? false,
        isBoosted: existingProduct.isBoosted ?? false,
      });
      // Set existing images for preview
      if (existingProduct.images && existingProduct.images.length > 0) {
        setExistingImages(existingProduct.images);
        setImagePreviews(existingProduct.images);
      }
    }
  }, [existingProduct, isEditMode, form]);
  
  const isOnSale = form.watch("isOnSale");

  const saveMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      const formData = new FormData();
      
      // Include existing images that weren't removed, plus any new files
      const allImages = [...existingImages];
      formData.append("data", JSON.stringify({ ...data, images: allImages }));
      imageFiles.forEach((file) => {
        formData.append("images", file);
      });

      const url = isEditMode ? `/api/products/${id}` : "/api/products";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Failed to ${isEditMode ? 'update' : 'create'} listing` }));
        throw new Error(errorData.message || `Error ${response.status}: Failed to ${isEditMode ? 'update' : 'create'} listing`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/my-listings"] });
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ["/api/products", id] });
      }
      toast({
        title: "Success",
        description: isEditMode ? "Product updated successfully!" : "Product listed successfully!",
      });
      setLocation("/seller/dashboard");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/auth/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditMode ? 'update' : 'create'} listing`,
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + imageFiles.length > 10) {
      toast({
        title: "Too many images",
        description: "Maximum 10 images allowed",
        variant: "destructive",
      });
      return;
    }

    setImageFiles([...imageFiles, ...files]);
    
    // Create previews
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    const preview = imagePreviews[index];
    
    // Check if this is an existing image (URL) or a new file preview (base64)
    if (existingImages.includes(preview)) {
      // Remove from existing images
      setExistingImages(prev => prev.filter(img => img !== preview));
    } else {
      // Find the corresponding file index (accounting for existing images)
      const fileIndex = index - existingImages.length;
      if (fileIndex >= 0) {
        setImageFiles(imageFiles.filter((_, i) => i !== fileIndex));
      }
    }
    
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const onSubmit = (data: InsertProduct) => {
    const totalImages = existingImages.length + imageFiles.length;
    if (totalImages === 0) {
      toast({
        title: "Images required",
        description: "Please upload at least one image",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(data);
  };

  if (isEditMode && isLoadingProduct) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show verification required message for non-verified users
  if (!isEditMode && !canCreateListing) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
              <Shield className="h-8 w-8 text-yellow-600" />
            </div>
            <CardTitle>Verification Required</CardTitle>
            <CardDescription>
              You need to verify your identity before you can list products for sale
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Why verification?</AlertTitle>
              <AlertDescription>
                We verify all sellers to prevent scams and build trust in our marketplace. 
                Verification is quick, easy, and only costs N200.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <h4 className="font-medium">Benefits of verification:</h4>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                <li>Green verified badge on your profile</li>
                <li>Ability to list and sell products</li>
                <li>Higher trust from buyers</li>
                <li>Access to all seller features</li>
              </ul>
            </div>
            
            <div className="flex flex-col gap-2 pt-4">
              <Link href="/kyc">
                <Button className="w-full" data-testid="button-verify-now">
                  <Shield className="mr-2 h-4 w-4" />
                  Verify Now - N200
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="w-full">
                  Go Back to Marketplace
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>{isEditMode ? "Edit Listing" : "Create New Listing"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Image Upload */}
              <div>
                <FormLabel>Product Images</FormLabel>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative aspect-square">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover rounded-md"
                        loading="lazy"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {imageFiles.length < 10 && (
                    <label className="aspect-square border-2 border-dashed border-muted-foreground/25 rounded-md flex flex-col items-center justify-center cursor-pointer hover-elevate">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="mt-2 text-sm text-muted-foreground">Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImageUpload}
                        data-testid="input-product-images"
                      />
                    </label>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Upload up to 10 images. First image will be the cover.
                </p>
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., iPhone 13 Pro Max 256GB" {...field} data-testid="input-product-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your item in detail..."
                        rows={5}
                        {...field}
                        data-testid="input-product-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sale Price Section */}
              <div className="border rounded-md p-4 space-y-4 bg-muted/30">
                <FormField
                  control={form.control}
                  name="isOnSale"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Put on Sale
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Show a discount badge and strikethrough original price
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-on-sale"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {isOnSale && (
                  <FormField
                    control={form.control}
                    name="originalPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Original Price (₦) - Before Discount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Enter original price before discount"
                            {...field}
                            value={field.value || ""}
                            data-testid="input-original-price"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          This will be shown with a strikethrough next to the sale price
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isOnSale ? "Sale Price (₦)" : "Price (₦)"}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          data-testid="input-product-price"
                        />
                      </FormControl>
                      {isOnSale && (
                        <p className="text-xs text-muted-foreground">
                          This is the discounted price customers will pay
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-product-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-product-condition">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="like_new">Like New</SelectItem>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="fair">Fair</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        Campus Location
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-product-location">
                            <SelectValue placeholder="Select your location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EKSU_LOCATIONS.map((loc) => (
                            <SelectItem key={loc.value} value={loc.value}>
                              {loc.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="flex-1"
                  data-testid="button-submit-product"
                >
                  {saveMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEditMode ? "Update Listing" : "Create Listing"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/seller/dashboard")}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
