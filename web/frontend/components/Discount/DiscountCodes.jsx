import { useAppBridge } from "@shopify/app-bridge-react";
import { getSessionToken } from "@shopify/app-bridge-utils";
import { Card } from "@shopify/polaris";
import { useEffect } from "react";
import axios from 'axios';
const DiscountCodes = () => {
    const app = useAppBridge();
    
    const createPriceSet = async () => {
        const priceRuleSet = {"hello": "true"}
        const token = await getSessionToken(app);
        console.log('Token:--', token);
        const config = {
            headers:{
                Authorization: 'Bearer ' + token,
            }, 
            body: JSON.stringify(priceRuleSet)
        }
        try {
            
            const data = await axios.post('/api/price-rule',priceRuleSet, config);
            console.log("PriceRule:--", data);
        } catch (error) {
            console.log("PriceRule:--", error);
            
        }
    }
    useEffect(() => {
        // createPriceSet()
    },[])
  return (
    <>
    <Card>

        <h1>Discount Code Generator</h1>
    </Card>
    </>
  )
}

export default DiscountCodes