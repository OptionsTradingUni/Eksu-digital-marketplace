import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Plus, SlidersHorizontal, X, MapPin, Wallet, Search } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import type { Product, Category } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

const EKSU_LOCATIONS = [
  { value: "all", label: "All Locations" },
  { value: "school_gate", label: "School Gate" },
  { value: "town", label: "Town" },
  { value: "yemkem", label: "Yemkem" },
  { value: "iworoko", label: "Iworoko" },
  { value: "phase2", label: "Phase2" },
  { value: "osekita", label: "Osekita" },
];

const BROKE_STUDENT_MAX_PRICE = 5000;
const DEFAULT_MAX_PRICE = 100000;
const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_CHARS = 2;

export default function Home() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  
  const { isSeller } = useAuth();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "all");
  const [priceRange, setPriceRange] = useState([0, DEFAULT_MAX_PRICE]);
  const [condition, setCondition] = useState(searchParams.get("condition") || "all");
  const [locationFilter, setLocationFilter] = useState(searchParams.get("location") || "all");
  const [isBrokeStudentMode, setIsBrokeStudentMode] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= MIN_SEARCH_CHARS || searchQuery.length === 0) {
        setDebouncedSearch(searchQuery);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleBrokeStudentMode = useCallback(() => {
    if (isBrokeStudentMode) {
      setPriceRange([0, DEFAULT_MAX_PRICE]);
      setIsBrokeStudentMode(false);
    } else {
      setPriceRange([0, BROKE_STUDENT_MAX_PRICE]);
      setIsBrokeStudentMode(true);
    }
  }, [isBrokeStudentMode]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== "all") count++;
    if (condition !== "all") count++;
    if (locationFilter !== "all") count++;
    if (priceRange[0] > 0 || priceRange[1] < DEFAULT_MAX_PRICE) count++;
    if (debouncedSearch.length >= MIN_SEARCH_CHARS) count++;
    return count;
  }, [selectedCategory, condition, locationFilter, priceRange, debouncedSearch]);

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: products, isLoading } = useQuery<(Product & { seller?: any })[]>({
    queryKey: ["/api/products", { 
      search: debouncedSearch.length >= MIN_SEARCH_CHARS ? debouncedSearch : undefined, 
      category: selectedCategory !== "all" ? selectedCategory : undefined, 
      condition: condition !== "all" ? condition : undefined, 
      location: locationFilter !== "all" ? locationFilter : undefined 
    }],
  });

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (selectedCategory && selectedCategory !== "all") params.set("category", selectedCategory);
    if (condition && condition !== "all") params.set("condition", condition);
    if (locationFilter && locationFilter !== "all") params.set("location", locationFilter);
    setLocation(`/?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setSelectedCategory("all");
    setCondition("all");
    setLocationFilter("all");
    setPriceRange([0, DEFAULT_MAX_PRICE]);
    setIsBrokeStudentMode(false);
    setLocation("/");
  };

  const getLocationLabel = (value: string) => {
    return EKSU_LOCATIONS.find(loc => loc.value === value)?.label || value;
  };

  const FilterPanel = () => (
    <div className="space-y-6">
      <div className="p-3 rounded-md bg-muted/50 border">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <Label className="font-semibold">Campus Location</Label>
        </div>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger data-testid="select-location" className={locationFilter !== "all" ? "ring-2 ring-primary/50" : ""}>
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            {EKSU_LOCATIONS.map((loc) => (
              <SelectItem key={loc.value} value={loc.value}>
                {loc.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Button
          variant={isBrokeStudentMode ? "default" : "outline"}
          className={`w-full gap-2 ${isBrokeStudentMode ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
          onClick={toggleBrokeStudentMode}
          data-testid="button-broke-student-filter"
        >
          <Wallet className="h-4 w-4" />
          Broke Student Mode
          {isBrokeStudentMode && <Badge variant="secondary" className="ml-auto text-xs">Under ₦5k</Badge>}
        </Button>
      </div>

      <div>
        <Label>Category</Label>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger data-testid="select-category" className={selectedCategory !== "all" ? "ring-2 ring-primary/50" : ""}>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Condition</Label>
        <Select value={condition} onValueChange={setCondition}>
          <SelectTrigger data-testid="select-condition" className={condition !== "all" ? "ring-2 ring-primary/50" : ""}>
            <SelectValue placeholder="Any Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Condition</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="like_new">Like New</SelectItem>
            <SelectItem value="good">Good</SelectItem>
            <SelectItem value="fair">Fair</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Price Range</Label>
          {(priceRange[0] > 0 || priceRange[1] < DEFAULT_MAX_PRICE) && (
            <Badge variant="secondary" className="text-xs">Active</Badge>
          )}
        </div>
        <div className="pt-2">
          <Slider
            value={priceRange}
            onValueChange={(value) => {
              setPriceRange(value);
              if (value[1] !== BROKE_STUDENT_MAX_PRICE) {
                setIsBrokeStudentMode(false);
              }
            }}
            max={DEFAULT_MAX_PRICE}
            step={1000}
            className="mb-2"
            data-testid="slider-price-range"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>₦{priceRange[0].toLocaleString()}</span>
            <span>₦{priceRange[1].toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSearch} className="flex-1" data-testid="button-apply-filters">
          Apply Filters
        </Button>
        <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const filteredProducts = products?.filter((p) => {
    const price = parseFloat(p.price as string);
    return price >= priceRange[0] && price <= priceRange[1];
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Filters</h2>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" data-testid="badge-active-filters">
                    {activeFilterCount} active
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear
                </Button>
              </div>
              <FilterPanel />
            </div>
          </aside>

          <main className="flex-1">
            <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
              <h1 className="text-2xl font-bold">Browse Products</h1>
              <div className="flex gap-2 flex-wrap">
                {isSeller && (
                  <Button asChild data-testid="button-create-listing">
                    <Link href="/products/new">
                      <Plus className="h-4 w-4 mr-2" />
                      Sell Item
                    </Link>
                  </Button>
                )}
                <Sheet>
                  <SheetTrigger asChild className="lg:hidden">
                    <Button variant="outline" className="gap-2" data-testid="button-mobile-filters">
                      <SlidersHorizontal className="h-4 w-4" />
                      Filters
                      {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        Filters
                        {activeFilterCount > 0 && (
                          <Badge variant="secondary">{activeFilterCount} active</Badge>
                        )}
                      </SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <FilterPanel />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search products... (type 2+ characters)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className={`pl-10 ${searchQuery.length >= MIN_SEARCH_CHARS ? "ring-2 ring-primary/50" : ""}`}
                  data-testid="input-search-products"
                />
              </div>
              {searchQuery.length > 0 && searchQuery.length < MIN_SEARCH_CHARS && (
                <p className="text-xs text-muted-foreground mt-1">
                  Type {MIN_SEARCH_CHARS - searchQuery.length} more character(s) to search
                </p>
              )}
            </div>

            {activeFilterCount > 0 && (
              <div className="mb-4 flex flex-wrap gap-2" data-testid="active-filters-display">
                {debouncedSearch.length >= MIN_SEARCH_CHARS && (
                  <Badge variant="outline" className="gap-1">
                    Search: "{debouncedSearch}"
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => { setSearchQuery(""); setDebouncedSearch(""); }}
                    />
                  </Badge>
                )}
                {selectedCategory !== "all" && (
                  <Badge variant="outline" className="gap-1">
                    Category: {categories?.find(c => c.id === selectedCategory)?.name || selectedCategory}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setSelectedCategory("all")}
                    />
                  </Badge>
                )}
                {condition !== "all" && (
                  <Badge variant="outline" className="gap-1">
                    Condition: {condition.replace("_", " ")}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setCondition("all")}
                    />
                  </Badge>
                )}
                {locationFilter !== "all" && (
                  <Badge variant="outline" className="gap-1">
                    <MapPin className="h-3 w-3" />
                    {getLocationLabel(locationFilter)}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setLocationFilter("all")}
                    />
                  </Badge>
                )}
                {(priceRange[0] > 0 || priceRange[1] < DEFAULT_MAX_PRICE) && (
                  <Badge variant="outline" className="gap-1">
                    {isBrokeStudentMode ? (
                      <>
                        <Wallet className="h-3 w-3" />
                        Broke Student Mode
                      </>
                    ) : (
                      <>₦{priceRange[0].toLocaleString()} - ₦{priceRange[1].toLocaleString()}</>
                    )}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => { setPriceRange([0, DEFAULT_MAX_PRICE]); setIsBrokeStudentMode(false); }}
                    />
                  </Badge>
                )}
              </div>
            )}

            {isLoading ? (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
                {[...Array(8)].map((_, i) => (
                  <Card key={i}>
                    <Skeleton className="aspect-square" />
                    <CardContent className="p-4">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-6 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredProducts && filteredProducts.length > 0 ? (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">No products found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try adjusting your filters or search query
                </p>
                {activeFilterCount > 0 && (
                  <Button variant="outline" onClick={clearFilters} className="mt-4">
                    Clear All Filters
                  </Button>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
