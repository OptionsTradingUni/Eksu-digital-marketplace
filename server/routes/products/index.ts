import { Router, type Express } from "express";
import crypto from "crypto";
import { storage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { insertProductSchema } from "../../../shared/schema";
import { uploadMultipleToObjectStorage } from "../../object-storage";
import {
  getUserId,
  isSuperAdmin,
  MAX_LISTINGS_UNVERIFIED,
  upload,
  requireEmailVerified
} from "../common";

const router = Router();

router.get("/products", async (req, res) => {
  try {
    const { search, category, condition, location, sellerId } = req.query;
    const products = await storage.getProducts({
      search: search as string,
      categoryId: category as string,
      condition: condition as string,
      location: location as string,
      sellerId: sellerId as string,
    });
    
    const productsWithSellerSettings = await Promise.all(
      products.map(async (product) => {
        try {
          const sellerSettings = await storage.getOrCreateUserSettings(product.sellerId) as any;
          return {
            ...product,
            sellerSettings: sellerSettings.locationVisible ? {
              latitude: sellerSettings.latitude,
              longitude: sellerSettings.longitude,
              locationVisible: sellerSettings.locationVisible,
            } : null,
          };
        } catch (err) {
          return { ...product, sellerSettings: null };
        }
      })
    );
    
    res.json(productsWithSellerSettings);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

router.get("/products/my-listings", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const products = await storage.getSellerProducts(userId);
    res.json(products);
  } catch (error) {
    console.error("Error fetching seller products:", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

router.get("/products/seller", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const products = await storage.getSellerProducts(userId);
    res.json(products);
  } catch (error) {
    console.error("Error fetching seller products:", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

router.get("/products/:id", async (req: any, res) => {
  try {
    const product = await storage.getProduct(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    const userId = getUserId(req);
    let viewerId: string;
    
    if (userId) {
      viewerId = `user_${userId}`;
    } else {
      const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      const sessionId = req.sessionID || req.headers['user-agent'] || 'unknown';
      const combined = `${ip}_${sessionId}`;
      viewerId = `guest_${crypto.createHash('sha256').update(combined).digest('hex').substring(0, 32)}`;
    }
    
    try {
      await storage.recordUniqueProductView(req.params.id, viewerId);
    } catch (viewError) {
      console.error("Error recording product view:", viewError);
    }
    
    let sellerSettings = null;
    try {
      const settings = await storage.getOrCreateUserSettings(product.sellerId) as any;
      if (settings.locationVisible) {
        sellerSettings = {
          latitude: settings.latitude,
          longitude: settings.longitude,
          locationVisible: settings.locationVisible,
        };
      }
    } catch (err) {
      console.error("Error fetching seller settings:", err);
    }
    
    res.json({ ...product, sellerSettings });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

router.post("/products", isAuthenticated, upload.array("images", 10), async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    if (user.role !== "seller" && user.role !== "admin") {
      return res.status(403).json({ 
        message: "Only sellers can create listings. Please update your role to 'Seller' in your profile settings." 
      });
    }

    if (!user.isVerified && !user.ninVerified) {
      return res.status(403).json({ 
        message: "Please complete identity verification before listing products. Go to Settings > KYC Verification to get started." 
      });
    }

    if (!user.emailVerified && user.role !== "admin" && !isSuperAdmin(userId)) {
      const existingProducts = await storage.getSellerProducts(userId);
      if (existingProducts.length >= MAX_LISTINGS_UNVERIFIED) {
        return res.status(403).json({ 
          message: `Please verify your email to create more listings. Unverified accounts are limited to ${MAX_LISTINGS_UNVERIFIED} listings.`,
          code: "EMAIL_NOT_VERIFIED",
          action: "verify_email"
        });
      }
    }

    let productData;
    try {
      productData = JSON.parse(req.body.data || "{}");
    } catch (parseError) {
      return res.status(400).json({ message: "Invalid product data format" });
    }

    const validationResult = insertProductSchema.safeParse(productData);
    if (!validationResult.success) {
      const errors = validationResult.error.flatten();
      const errorMessages = Object.entries(errors.fieldErrors)
        .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
        .join("; ");
      console.log("Product validation failed:", errors);
      return res.status(400).json({ 
        message: errorMessages || "Validation failed",
        errors: errors.fieldErrors
      });
    }

    const validated = validationResult.data;

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ message: "At least one product image is required" });
    }

    const prefix = `products/${userId}/`;
    const images = await uploadMultipleToObjectStorage(files, prefix);
    
    if (images.length === 0) {
      return res.status(500).json({ message: "Failed to upload product images" });
    }

    const product = await storage.createProduct({
      ...validated,
      sellerId: userId,
      images,
    });

    res.json(product);
  } catch (error: any) {
    console.error("Error creating product:", error);
    res.status(500).json({ message: error.message || "Failed to create product" });
  }
});

router.put("/products/:id", isAuthenticated, upload.array("images", 10), async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const existing = await storage.getProduct(req.params.id);
    if (!existing || existing.sellerId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const productData = JSON.parse(req.body.data || "{}");
    
    const files = req.files as Express.Multer.File[];
    let newImages: string[] = [];
    
    if (files && files.length > 0) {
      const prefix = `products/${userId}/`;
      newImages = await uploadMultipleToObjectStorage(files, prefix);
    }

    const clientImages = productData.images || existing.images || [];
    const finalImages = [...clientImages, ...newImages];

    const updateData = {
      ...productData,
      images: finalImages.length > 0 ? finalImages : existing.images,
    };

    const updated = await storage.updateProduct(req.params.id, updateData);
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating product:", error);
    res.status(400).json({ message: error.message || "Failed to update product" });
  }
});

router.delete("/products/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const product = await storage.getProduct(req.params.id);
    if (!product || product.sellerId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await storage.deleteProduct(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

router.post("/products/:id/sold", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const product = await storage.getProduct(req.params.id);
    if (!product || product.sellerId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updated = await storage.updateProduct(req.params.id, {
      isSold: true,
      isAvailable: false,
    });
    res.json(updated);
  } catch (error) {
    console.error("Error marking product as sold:", error);
    res.status(500).json({ message: "Failed to mark product as sold" });
  }
});

router.post("/products/:id/toggle-visibility", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const product = await storage.getProduct(req.params.id);
    if (!product || product.sellerId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updated = await storage.updateProduct(req.params.id, {
      isAvailable: !product.isAvailable,
    });
    res.json(updated);
  } catch (error) {
    console.error("Error toggling product visibility:", error);
    res.status(500).json({ message: "Failed to toggle product visibility" });
  }
});

router.get("/seller/products", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const products = await storage.getSellerProductsWithAnalytics(userId);
    res.json(products);
  } catch (error) {
    console.error("Error fetching seller products:", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

export function registerProductRoutes(app: Express) {
  app.use("/api", router);
}
