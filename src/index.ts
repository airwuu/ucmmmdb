/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { users , menu, item } from '../schemas/drizzle'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and } from 'drizzle-orm';
import { Hono } from 'hono'
import {nameLocation, nameCategoryPav, nameCategoryDC, nameDay, idLocation,idCategoryPav, idCategoryDC,idDay, pavMenuGroupTime, formatTimePAV, fetchMenu, formatTimeDC, dcMenuGroupTime} from "./menu_functions"
import { v4 as uuidv4 } from 'uuid';
import { cors } from 'hono/cors'
const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use(cors());

app.get('/', (c) => {
  return c.text('Hello Hono changed!')
})


// app.get('/users', async (c) => {
//   const db = drizzle(c.env.DB)
//   const result = await db.select().from(users).all()
//   return c.json(result)
// })

app.use(
  '/*',
  cors({
    origin: ['http://ucmmm.com', 'http://localhost:3000/'],
    allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
    maxAge: 600,
    credentials: true,
  })
)

app.get('/menu/:week/:location/:day/:meal', async (c) => {
  const db = drizzle(c.env.DB)
  const {week} = c.req.param()
  const {location} = c.req.param()
  const {day} = c.req.param()
  const {meal} = c.req.param()
  const result = await db.select().from(menu).where(
    and(
      eq(menu.week, week),
      eq(menu.location, location),
      eq(menu.day, day),
      eq(menu.meal, meal)
    )
  )
  return c.json(result)
})
app.get('/item/:id', async (c) => {
  const db = drizzle(c.env.DB)
  const {id} = c.req.param()
  const result = await db.select().from(item).where(eq(item.item_id, id),)
  return c.json(result)
})
app.post('/item/:id/missing', async (c) => {
  const db = drizzle(c.env.DB);
  const { id } = c.req.param();
  const currentItem = await db.select().from(item).where(eq(item.item_id, id)).execute();
  if (currentItem.length === 0) {
    return c.json({ error: "Item not found" }, 404); 
  }
  const updatedReports = currentItem[0].missing_reports + 1;
  const result = await db.update(item)
    .set({ missing_reports: updatedReports })
    .where(eq(item.item_id, id));
  return c.json({ success: true, updatedReports });
});

// note: when i run a cron job to update, use thie fetch request

// ANOTEHRR NOTE: PROBABLY BETTER TO JUST MOVE THIS OFF OF AN API ENDPOIJNT>???? WHAT WERE YOU THINKING
// JUST HAVE THE CRON FUNCTION JUST UPDATE IT LMAO. 
// PROTECT AGAINST DUPLICATE CALLS?

// fetch("https://ucmmmdb.ucmmm-ucm.workers.dev/weekly-update", {
//   method: "POST",
// })
//   .then(response => response.json()) // if expecting a JSON response
//   .then(data => console.log(data))
//   .catch(error => console.error("Error:", error));

// curl -X POST https://ucmmmdb.ucmmm-ucm.workers.dev/weekly-update
app.get('/weekly-update-pav', async (c) => {
  const db = drizzle(c.env.DB)
  const result = await db.select().from(menu).all()
  return c.json(result)
})
.post('/weekly-update-pav', async (c) => {
  const db = drizzle(c.env.DB)
  try {
    for (let locationIndex = 0; locationIndex < 1; locationIndex++) {
      for (let dayIndex = 0; dayIndex < idDay.length; dayIndex++) {
        const categoryArray = locationIndex === 0 ? idCategoryPav : idCategoryDC;
        const nameCategoryArray = locationIndex === 0 ? nameCategoryPav : nameCategoryDC;
  
        for (let categoryIndex = 0; categoryIndex < categoryArray.length; categoryIndex++) {
          try {
            // Fetch the menu data for this location, day, and category (meal)
            const menuData:any = await fetchMenu(locationIndex, dayIndex, categoryIndex);
            const orderedPairs = menuData.data.menuItems.map((item: { name: string; description: string; }) => [item.name, item.description] as [string, string]);
            // ordered pairs look like: Greek Chicken,@Carbone: Protein Choice of Greek Chicken (4oz) or Greek Eggplant Steaks (4oz) with Garlic Butter
            for (let i = 0; i < orderedPairs.length; i++){
                const stationName = (orderedPairs[i][1].includes(":") ? orderedPairs[i][1].match(/^[^:]+/)[0] : "")
                const items = orderedPairs[i][1].replace(/^[^:]*:\s*/, "")// this is a really dumb way to parse the menu (case insensitive)
                .replace(/\s*\(.*?\)\s*/g, ' ')  // remove content in parentheses
                .replace(/:/g, ' ')      //destroy colons
                .replace(/;/g, ' ') 
                // remove verbose langauge >:C
                .replace(/\bProtein\b/gi, ' ')    
                .replace(/\bChoice\b/gi, ' ')    
                .replace(/\bOf\b/gi, ' ')    
                .replace(/\bServed\b/gi, ' ')
                .replace(/\bSides\b/gi, ' ')       
                .replace(/\bOption\b/gi, ' ')       
                .replace(/\bOptions\b/gi, ' ')    
                .replace(/\bCome\b/gi, ' ')    
                .replace(/\bComes\b/gi, ' ') 
                .replace(/\bMeal\b/gi, ' ')  
                .replace(/\bMindful\b/gi, ' ')     
                //split these into different items   
                .replace(/\bOn a\b/gi, ',')  
                .replace(/\bthe day\b/gi, ',')  
                .replace(/\bOn\b/gi, ',')  
                .replace(/\bOr\b/gi, ',')       
                .replace(/\bAnd\b/gi, ',')       
                .replace(/&/g, ',')  //&
                .replace(/\bWith\b/gi, ',')     
                .replace(/\bIn\b/gi, ',')      
                .replace(/w\//g, ',')    //  w/
                
                // format string for further use  
                .replace(/\. /g, ",") // i cant believe they also typo , as . 
                .split(',')
                .map((item: string) => item.trim()) //remove whitepsace
                .map((item: string) => item.trim().replace(/\.$/, '')) //remove trailing periods
                .filter((item: string) => item !== ''); //remove empty items
                for (let j = 0; j < items.length; j++){
                    // console.log(nameLocation[locationIndex]+ " : " + nameCategoryArray[categoryIndex] + " : " + nameDay[dayIndex] + " : " + stationName + " : " + items[j])
                    const newItemID= uuidv4()
                    await db.insert(item).values({
                            item_id: newItemID,
                            name: items[j],
                            missing_reports: 0,
                    });
                    await db.insert(menu).values({ // Ensure `id` is from itemData
                             // Ensure this is the intended way to record week
                            location: nameLocation[locationIndex], // Make sure this is a string
                            day: nameDay[dayIndex], // Make sure this is a string
                            meal: nameCategoryArray[categoryIndex], // Make sure this is a string
                            station: stationName, // Ensure this is a string
                            item_id: newItemID, // Use the correct field for the item_id
                    });
                }
            }
            console.log("successfully updated database")
          } catch (error) {
            console.error(`Error fetching and inserting data for location ${locationIndex}, day ${dayIndex}, category ${categoryIndex}:`, error);
          }
        }
      }
    }
  }
  catch{
    console.log("ded")
  }
  return c.text('attempted to update weekly thing to pav')
})

app.get('/weekly-update-dc', async (c) => {
  const db = drizzle(c.env.DB)
  const result = await db.select().from(menu).all()
  return c.json(result)
})
.post('/weekly-update-dc', async (c) => {
  const db = drizzle(c.env.DB)
  try {
    for (let locationIndex = 1; locationIndex < 2; locationIndex++) {
      for (let dayIndex = 0; dayIndex < idDay.length; dayIndex++) {
        const categoryArray = locationIndex === 0 ? idCategoryPav : idCategoryDC;
        const nameCategoryArray = locationIndex === 0 ? nameCategoryPav : nameCategoryDC;
  
        for (let categoryIndex = 0; categoryIndex < categoryArray.length; categoryIndex++) {
          try {
            // Fetch the menu data for this location, day, and category (meal)
            const menuData:any = await fetchMenu(locationIndex, dayIndex, categoryIndex);
            const orderedPairs = menuData.data.menuItems.map((item: { name: string; description: string; }) => [item.name, item.description] as [string, string]);
            // ordered pairs look like: Greek Chicken,@Carbone: Protein Choice of Greek Chicken (4oz) or Greek Eggplant Steaks (4oz) with Garlic Butter
            for (let i = 0; i < orderedPairs.length; i++){
                const stationName = (orderedPairs[i][1].includes(":") ? orderedPairs[i][1].match(/^[^:]+/)[0] : "")
                const items = orderedPairs[i][1].replace(/^[^:]*:\s*/, "")// this is a really dumb way to parse the menu (case insensitive)
                .replace(/\s*\(.*?\)\s*/g, ' ')  // remove content in parentheses
                .replace(/:/g, ' ')      //destroy colons
                .replace(/;/g, ' ') 
                // remove verbose langauge >:C
                .replace(/\bProtein\b/gi, ' ')    
                .replace(/\bChoice\b/gi, ' ')    
                .replace(/\bOf\b/gi, ' ')    
                .replace(/\bServed\b/gi, ' ')
                .replace(/\bSides\b/gi, ' ')       
                .replace(/\bOption\b/gi, ' ')       
                .replace(/\bOptions\b/gi, ' ')    
                .replace(/\bCome\b/gi, ' ')    
                .replace(/\bComes\b/gi, ' ') 
                .replace(/\bMeal\b/gi, ' ')  
                .replace(/\bMindful\b/gi, ' ')     
                //split these into different items   
                .replace(/\bOn a\b/gi, ',')  
                .replace(/\bthe day\b/gi, ',')  
                .replace(/\bOn\b/gi, ',')  
                .replace(/\bOr\b/gi, ',')       
                .replace(/\bAnd\b/gi, ',')       
                .replace(/&/g, ',')  //&
                .replace(/\bWith\b/gi, ',')     
                .replace(/\bIn\b/gi, ',')      
                .replace(/w\//g, ',')    //  w/
                
                // format string for further use  
                .replace(/\. /g, ",") // i cant believe they also typo , as . 
                .split(',')
                .map((item: string) => item.trim()) //remove whitepsace
                .map((item: string) => item.trim().replace(/\.$/, '')) //remove trailing periods
                .filter((item: string) => item !== ''); //remove empty items
                for (let j = 0; j < items.length; j++){
                    // console.log(nameLocation[locationIndex]+ " : " + nameCategoryArray[categoryIndex] + " : " + nameDay[dayIndex] + " : " + stationName + " : " + items[j])
                    const newItemID= uuidv4()
                    await db.insert(item).values({
                            item_id: newItemID,
                            name: items[j],
                            missing_reports: 0,
                    });
                    await db.insert(menu).values({ // Ensure `id` is from itemData
                             // Ensure this is the intended way to record week
                            location: nameLocation[locationIndex], // Make sure this is a string
                            day: nameDay[dayIndex], // Make sure this is a string
                            meal: nameCategoryArray[categoryIndex], // Make sure this is a string
                            station: stationName, // Ensure this is a string
                            item_id: newItemID, // Use the correct field for the item_id
                    });
                }
            }
            console.log("successfully updated database")
          } catch (error) {
            console.error(`Error fetching and inserting data for location ${locationIndex}, day ${dayIndex}, category ${categoryIndex}:`, error);
          }
        }
      }
    }
  }
  catch{
    console.log("ded")
  }
  return c.text('attempted to update weekly thing to pav')
})

export default app
