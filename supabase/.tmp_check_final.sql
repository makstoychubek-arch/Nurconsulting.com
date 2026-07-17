select campaign_id, campaign_name, payment_type, bid_type, updated_at
from advertising_campaigns
where cabinet_id='02f5d3cb-6c86-47e5-b0c4-ccb5a32d8a7a'
order by updated_at desc limit 10;
