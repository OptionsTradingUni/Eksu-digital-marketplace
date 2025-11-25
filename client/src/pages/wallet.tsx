import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle, Wallet as WalletIcon } from "lucide-react";
import { format } from "date-fns";
import type { Wallet, Transaction } from "@shared/schema";

export default function WalletPage() {
  const { toast } = useToast();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const { data: wallet, isLoading: walletLoading } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/wallet/transactions"],
  });

  const depositMutation = useMutation({
    mutationFn: async (amount: string) => {
      const response = await apiRequest("POST", "/api/wallet/deposit", { amount });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
      toast({
        title: "Deposit initiated",
        description: "Redirecting to payment gateway...",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Deposit failed",
        description: error.message || "Unable to process deposit",
        variant: "destructive",
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: { amount: string; bankName: string; accountNumber: string; accountName: string }) => {
      const response = await apiRequest("POST", "/api/wallet/withdraw", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Withdrawal requested",
        description: "Your withdrawal is being processed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      setWithdrawAmount("");
      setBankName("");
      setAccountNumber("");
      setAccountName("");
    },
    onError: (error: any) => {
      toast({
        title: "Withdrawal failed",
        description: error.message || "Unable to process withdrawal",
        variant: "destructive",
      });
    },
  });

  const handleDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < 100) {
      toast({
        title: "Invalid amount",
        description: "Minimum deposit is 100 NGN",
        variant: "destructive",
      });
      return;
    }
    depositMutation.mutate(depositAmount);
  };

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 500) {
      toast({
        title: "Invalid amount",
        description: "Minimum withdrawal is 500 NGN",
        variant: "destructive",
      });
      return;
    }
    if (!bankName || !accountNumber || !accountName) {
      toast({
        title: "Missing information",
        description: "Please fill in all bank details",
        variant: "destructive",
      });
      return;
    }
    withdrawMutation.mutate({ amount: withdrawAmount, bankName, accountNumber, accountName });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "deposit":
      case "welcome_bonus":
      case "referral_bonus":
      case "sale":
      case "escrow_release":
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case "withdrawal":
      case "purchase":
      case "boost_payment":
      case "escrow_hold":
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatAmount = (amount: string, type: string) => {
    const isCredit = ["deposit", "welcome_bonus", "referral_bonus", "sale", "escrow_release", "refund"].includes(type);
    return (
      <span className={isCredit ? "text-green-600" : "text-red-600"}>
        {isCredit ? "+" : "-"}{parseFloat(amount).toLocaleString()}
      </span>
    );
  };

  if (walletLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-48 w-full mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Wallet</h1>
        <p className="text-muted-foreground">Manage your funds and transactions</p>
      </div>

      <Card className="mb-8 bg-gradient-to-br from-primary/20 to-primary/5">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <WalletIcon className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">Your Balance</p>
            <h2 className="text-4xl font-bold text-primary" data-testid="text-wallet-balance">
              {parseFloat(wallet?.balance || "0").toLocaleString()}
            </h2>
            {wallet?.escrowBalance && parseFloat(wallet.escrowBalance) > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                + {parseFloat(wallet.escrowBalance).toLocaleString()} in escrow
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="deposit" className="mb-8">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="deposit" data-testid="tab-deposit">
            <Plus className="h-4 w-4 mr-2" />
            Deposit
          </TabsTrigger>
          <TabsTrigger value="withdraw" data-testid="tab-withdraw">
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Withdraw
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Clock className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deposit">
          <Card>
            <CardHeader>
              <CardTitle>Online Deposit</CardTitle>
              <CardDescription>
                Add funds to your wallet using card or bank transfer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="deposit-amount">Amount (NGN)</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  placeholder="Enter amount (min 100)"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  data-testid="input-deposit-amount"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[500, 1000, 2000, 5000, 10000].map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => setDepositAmount(amount.toString())}
                    data-testid={`button-preset-${amount}`}
                  >
                    {amount.toLocaleString()}
                  </Button>
                ))}
              </div>
              <Button
                onClick={handleDeposit}
                disabled={depositMutation.isPending}
                className="w-full"
                data-testid="button-deposit"
              >
                {depositMutation.isPending ? "Processing..." : "Deposit Now"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdraw">
          <Card>
            <CardHeader>
              <CardTitle>Withdraw to Bank</CardTitle>
              <CardDescription>
                Transfer funds to your bank account (min 500 NGN)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="withdraw-amount">Amount (NGN)</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  placeholder="Enter amount (min 500)"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  data-testid="input-withdraw-amount"
                />
              </div>
              <div>
                <Label htmlFor="bank-name">Bank Name</Label>
                <Input
                  id="bank-name"
                  placeholder="e.g., Access Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  data-testid="input-bank-name"
                />
              </div>
              <div>
                <Label htmlFor="account-number">Account Number</Label>
                <Input
                  id="account-number"
                  placeholder="10 digit account number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  maxLength={10}
                  data-testid="input-account-number"
                />
              </div>
              <div>
                <Label htmlFor="account-name">Account Name</Label>
                <Input
                  id="account-name"
                  placeholder="Name on account"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  data-testid="input-account-name"
                />
              </div>
              <Button
                onClick={handleWithdraw}
                disabled={withdrawMutation.isPending}
                className="w-full"
                data-testid="button-withdraw"
              >
                {withdrawMutation.isPending ? "Processing..." : "Withdraw"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Your recent wallet activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : transactions && transactions.length > 0 ? (
                <div className="space-y-4">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`transaction-${tx.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-full bg-muted p-2">
                          {getTransactionIcon(tx.type)}
                        </div>
                        <div>
                          <p className="font-medium capitalize">
                            {tx.type.replace(/_/g, " ")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {tx.description || format(new Date(tx.createdAt!), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatAmount(tx.amount, tx.type)}
                        </p>
                        {getStatusBadge(tx.status || "completed")}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <WalletIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No transactions yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
