import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle, Wallet as WalletIcon, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import type { Wallet, Transaction } from "@shared/schema";

interface Bank {
  name: string;
  code: string;
}

interface VerifiedAccount {
  accountNumber: string;
  accountName: string;
  bankCode: string;
}

export default function WalletPage() {
  const { toast } = useToast();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedBankCode, setSelectedBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [verifiedAccount, setVerifiedAccount] = useState<VerifiedAccount | null>(null);
  const [accountConfirmed, setAccountConfirmed] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const { data: wallet, isLoading: walletLoading } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/wallet/transactions"],
  });

  const { data: banks, isLoading: banksLoading } = useQuery<Bank[]>({
    queryKey: ["/api/monnify/banks"],
  });

  const verifyAccountMutation = useMutation({
    mutationFn: async ({ accountNumber, bankCode }: { accountNumber: string; bankCode: string }) => {
      const response = await fetch(`/api/monnify/verify-account?accountNumber=${accountNumber}&bankCode=${bankCode}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to verify account");
      }
      return response.json() as Promise<VerifiedAccount>;
    },
    onSuccess: (data) => {
      setVerifiedAccount(data);
      setVerificationError(null);
      setAccountConfirmed(false);
    },
    onError: (error: Error) => {
      setVerifiedAccount(null);
      setVerificationError(error.message);
      setAccountConfirmed(false);
    },
  });

  useEffect(() => {
    if (accountNumber.length === 10 && selectedBankCode) {
      setVerifiedAccount(null);
      setAccountConfirmed(false);
      setVerificationError(null);
      verifyAccountMutation.mutate({ accountNumber, bankCode: selectedBankCode });
    } else {
      setVerifiedAccount(null);
      setAccountConfirmed(false);
      setVerificationError(null);
    }
  }, [accountNumber, selectedBankCode]);

  const selectedBank = banks?.find(b => b.code === selectedBankCode);

  const depositMutation = useMutation({
    mutationFn: async (amount: string) => {
      const response = await apiRequest("POST", "/api/monnify/initialize", { 
        amount,
        purpose: "wallet_deposit",
        paymentDescription: `Wallet deposit of ₦${parseFloat(amount).toLocaleString()}`,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({
          title: "Deposit initiated",
          description: "Redirecting to payment gateway...",
        });
      }
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
    mutationFn: async (data: { amount: string; bankName: string; accountNumber: string; accountName: string; bankCode: string }) => {
      const response = await apiRequest("POST", "/api/monnify/withdraw", data);
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
      setSelectedBankCode("");
      setAccountNumber("");
      setVerifiedAccount(null);
      setAccountConfirmed(false);
      setVerificationError(null);
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
    if (!selectedBankCode || !selectedBank) {
      toast({
        title: "Missing information",
        description: "Please select a bank",
        variant: "destructive",
      });
      return;
    }
    if (!verifiedAccount) {
      toast({
        title: "Account not verified",
        description: "Please wait for account verification to complete",
        variant: "destructive",
      });
      return;
    }
    if (!accountConfirmed) {
      toast({
        title: "Account not confirmed",
        description: "Please confirm the account name before proceeding",
        variant: "destructive",
      });
      return;
    }
    withdrawMutation.mutate({ 
      amount: withdrawAmount, 
      bankName: selectedBank.name, 
      accountNumber: verifiedAccount.accountNumber, 
      accountName: verifiedAccount.accountName,
      bankCode: selectedBankCode,
    });
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

  const handleAccountNumberChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 10);
    setAccountNumber(numericValue);
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
                <Label htmlFor="bank-select">Select Bank</Label>
                {banksLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select
                    value={selectedBankCode}
                    onValueChange={(value) => {
                      setSelectedBankCode(value);
                      setVerifiedAccount(null);
                      setAccountConfirmed(false);
                    }}
                  >
                    <SelectTrigger id="bank-select" data-testid="select-bank">
                      <SelectValue placeholder="Choose your bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks?.map((bank) => (
                        <SelectItem key={bank.code} value={bank.code} data-testid={`bank-option-${bank.code}`}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label htmlFor="account-number">Account Number</Label>
                <Input
                  id="account-number"
                  placeholder="10 digit account number"
                  value={accountNumber}
                  onChange={(e) => handleAccountNumberChange(e.target.value)}
                  maxLength={10}
                  data-testid="input-account-number"
                />
                {accountNumber.length > 0 && accountNumber.length < 10 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {10 - accountNumber.length} more digit{10 - accountNumber.length !== 1 ? 's' : ''} needed
                  </p>
                )}
              </div>

              {verifyAccountMutation.isPending && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg" data-testid="verification-loading">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Verifying account...</span>
                </div>
              )}

              {verificationError && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg" data-testid="verification-error">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{verificationError}</span>
                </div>
              )}

              {verifiedAccount && (
                <div className="space-y-3">
                  <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg" data-testid="verified-account">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-700 dark:text-green-300">Account Verified</span>
                    </div>
                    <p className="text-lg font-semibold" data-testid="text-account-name">
                      {verifiedAccount.accountName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedBank?.name} - {verifiedAccount.accountNumber}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="confirm-account"
                      checked={accountConfirmed}
                      onCheckedChange={(checked) => setAccountConfirmed(checked === true)}
                      data-testid="checkbox-confirm-account"
                    />
                    <Label htmlFor="confirm-account" className="text-sm cursor-pointer">
                      I confirm this is the correct account for withdrawal
                    </Label>
                  </div>
                </div>
              )}

              <Button
                onClick={handleWithdraw}
                disabled={withdrawMutation.isPending || !verifiedAccount || !accountConfirmed}
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
