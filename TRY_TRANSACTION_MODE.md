# Try Transaction Mode Pooler

## Alternative Connection Method

Since Session mode isn't working, try **Transaction mode** instead:

### DBeaver Settings:

**Main Tab:**
- Host: `aws-0-us-east-1.pooler.supabase.com`
- Port: `5432` ← **Different port for Transaction mode**
- Database: `postgres`
- Username: `postgres.uzbupbtrmbmmmkztmrtl`
- Password: (your newly reset database password)

**SSL Tab:**
- ✅ Use SSL: **Checked**
- SSL Mode: `require`

### Try Different Regions with Transaction Mode:

If `aws-0-us-east-1` doesn't work, try these (all with port `5432`):

- `aws-0-us-west-1.pooler.supabase.com`
- `aws-0-eu-west-1.pooler.supabase.com`
- `aws-0-ap-southeast-1.pooler.supabase.com`

## Difference:
- **Session mode** (port 6543): Better for DBeaver/interactive tools
- **Transaction mode** (port 5432): Alternative that might work better




