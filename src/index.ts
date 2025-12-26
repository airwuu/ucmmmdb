// /**
//  * Welcome to Cloudflare Workers! This is your first worker.
//  *
//  * - Run `npm run dev` in your terminal to start a development server
//  * - Open a browser tab at http://localhost:8787/ to see your worker in action
//  * - Run `npm run deploy` to publish your worker
//  *
//  * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
//  * `Env` object can be regenerated with `npm run cf-typegen`.
//  *
//  * Learn more at https://developers.cloudflare.com/workers/
//  */

// import dayjs from 'dayjs';
// import { menu } from '../schemas/drizzle'
// import { drizzle } from 'drizzle-orm/d1'
// import { eq, and } from 'drizzle-orm';
// import { Hono } from 'hono'
// import {nameLocation, nameCategoryPav, nameCategoryDC, nameDay, idLocation,idCategoryPav, idCategoryDC,idDay, pavMenuGroupTime, formatTimePAV, fetchMenu, formatTimeDC, dcMenuGroupTime} from "./menu_functions"
// import { v4 as uuidv4 } from 'uuid';
// import { cors } from 'hono/cors'
// const app = new Hono<{ Bindings: CloudflareBindings }>()

// app.use(cors());

// app.get('/', (c) => {
//   return c.text('Hello Hono changed! ucmmm!')
// })


// // app.get('/users', async (c) => {
// //   const db = drizzle(c.env.DB)
// //   const result = await db.select().from(users).all()
// //   return c.json(result)
// // })

// app.use(
//   '/*',
//   cors({
//     origin: ['http://ucmmm.com', 'http://localhost:3000/'],
//     allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests'],
//     allowMethods: ['POST', 'GET', 'OPTIONS'],
//     exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
//     maxAge: 600,
//     credentials: true,
//   })
// )

// app.get('/menu/:week/:location/:day/:meal', async (c) => {
//   const db = drizzle(c.env.DB);
//   const {week} = c.req.param();
//   const {location} = c.req.param();
//   const {day} = c.req.param();
//   const {meal} = c.req.param();

//   const result = await db.select().from(menu).where(
//     and(
//       eq(menu.week, week),
//       eq(menu.location, location),
//       eq(menu.day, day),  
//       eq(menu.meal, meal)
//     )
//   );
//   if (result.length === 0 && location == "pav"){
//     // gemini this is where you come in
//   }
//   return c.json(result);
// });


// app.get('/item/:id', async (c) => {
//   const db = drizzle(c.env.DB)
//   const {id} = c.req.param()
//   const result = await db.select().from(menu).where(eq(menu.item_id, id),)
//   return c.json(result)
// })
// app.post('/item/:id/missing', async (c) => {
//   const db = drizzle(c.env.DB);
//   const { id } = c.req.param();
//   const currentItem = await db.select().from(menu).where(eq(menu.item_id, id)).execute();
//   if (currentItem.length === 0) {
//     return c.json({ error: "Item not found" }, 404); 
//   }
//   const updatedReports = currentItem[0].missing_reports + 1;
//   const result = await db.update(menu)
//     .set({ missing_reports: updatedReports })
//     .where(eq(menu.item_id, id));
//   return c.json({ success: true, updatedReports });
// });
// app.post('/item/:id/missing/reset', async (c) => {
//   const db = drizzle(c.env.DB);
//   const { id } = c.req.param();
//   const currentItem = await db.select().from(menu).where(eq(menu.item_id, id)).execute();
//   if (currentItem.length === 0) {
//     return c.json({ error: "Item not found" }, 404); 
//   }
//   const updatedReports = 0;
//   const result = await db.update(menu)
//     .set({ missing_reports: updatedReports })
//     .where(eq(menu.item_id, id));
//   return c.json({ success: true, updatedReports });
// });

// // note: when i run a cron job to update, use thie fetch request

// // ANOTEHRR NOTE: PROBABLY BETTER TO JUST MOVE THIS OFF OF AN API ENDPOIJNT>???? WHAT WERE YOU THINKING
// // JUST HAVE THE CRON FUNCTION JUST UPDATE IT LMAO. 
// // PROTECT AGAINST DUPLICATE CALLS?

// // fetch("https://ucmmmdb.ucmmm-ucm.workers.dev/weekly-update", {
// //   method: "POST",
// // })
// //   .then(response => response.json()) // if expecting a JSON response
// //   .then(data => console.log(data))
// //   .catch(error => console.error("Error:", error));

// // curl -X POST https://ucmmmdb.ucmmm-ucm.workers.dev/weekly-update
// app.get('/weekly-update-pav', async (c) => {
//   const db = drizzle(c.env.DB)
//   const result = await db.select().from(menu).all()
//   return c.json(result)
// })
// .post('/weekly-update-pav', async (c) => {
//   const db = drizzle(c.env.DB)
//   const currentDate = dayjs();
//   const weekStart = currentDate.startOf('week'); 
//   const weekStartDateString = weekStart.format('YYYY-MM-DD'); 

//   try {
//     for (let locationIndex = 0; locationIndex < 1; locationIndex++) {
//       for (let dayIndex = 0; dayIndex < idDay.length; dayIndex++) {
//         const categoryArray = locationIndex === 0 ? idCategoryPav : idCategoryDC;
//         const nameCategoryArray = locationIndex === 0 ? nameCategoryPav : nameCategoryDC;

//         for (let categoryIndex = 0; categoryIndex < categoryArray.length; categoryIndex++) {
//           try {
//             // Fetch the menu data for this location, day, and category (meal)
//             const menuData:any = await fetchMenu(locationIndex, dayIndex, categoryIndex);
//             const orderedPairs = menuData.data.menuItems.map((item: { name: string; description: string; }) => [item.name, item.description] as [string, string]);
//             // ordered pairs look like: Greek Chicken,@Carbone: Protein Choice of Greek Chicken (4oz) or Greek Eggplant Steaks (4oz) with Garlic Butter
//             for (let i = 0; i < orderedPairs.length; i++){
//                 const stationName = (orderedPairs[i][1].includes(":") ? orderedPairs[i][1].match(/^[^:]+/)[0] : "")
//                 const items = orderedPairs[i][1].replace(/^[^:]*:\s*/, "")// this is a really dumb way to parse the menu (case insensitive)
//                 .replace(/\s*\(.*?\)\s*/g, ' ')  // remove content in parentheses
//                 .replace(/:/g, ' ')      //destroy colons
//                 .replace(/;/g, ' ') 
//                 // remove verbose langauge >:C
//                 .replace(/\bProtein\b/gi, ' ')    
//                 .replace(/\bChoice\b/gi, ' ')    
//                 .replace(/\bOf\b/gi, ' ')    
//                 .replace(/\bServed\b/gi, ' ')
//                 .replace(/\bSides\b/gi, ' ')       
//                 .replace(/\bOption\b/gi, ' ')       
//                 .replace(/\bOptions\b/gi, ' ')    
//                 .replace(/\bCome\b/gi, ' ')    
//                 .replace(/\bComes\b/gi, ' ') 
//                 .replace(/\bMeal\b/gi, ' ')  
//                 .replace(/\bMindful\b/gi, ' ')     
//                 //split these into different items   
//                 .replace(/\bOn a\b/gi, ',')  
//                 .replace(/\bthe day\b/gi, ',')  
//                 .replace(/\bOn\b/gi, ',')  
//                 .replace(/\bOr\b/gi, ',')       
//                 .replace(/\bAnd\b/gi, ',')       
//                 .replace(/&/g, ',')  //&
//                 .replace(/\bWith\b/gi, ',')     
//                 .replace(/\bIn\b/gi, ',')      
//                 .replace(/w\//g, ',')    //  w/

//                 // format string for further use  
//                 .replace(/\. /g, ",") // i cant believe they also typo , as . 
//                 .split(',')
//                 .map((item: string) => item.trim()) //remove whitepsace
//                 .map((item: string) => item.trim().replace(/\.$/, '')) //remove trailing periods
//                 .filter((item: string) => item !== ''); //remove empty items
//                 for (let j = 0; j < items.length; j++){
//                     // console.log(nameLocation[locationIndex]+ " : " + nameCategoryArray[categoryIndex] + " : " + nameDay[dayIndex] + " : " + stationName + " : " + items[j])
//                     const newItemID= uuidv4()
//                     await db.insert(menu).values({
//                             location: nameLocation[locationIndex], 
//                             day: nameDay[dayIndex], 
//                             meal: nameCategoryArray[categoryIndex], 
//                             station: stationName, 
//                             item_id: newItemID,
//                             name: items[j],
//                             missing_reports: 0,
//                             week: weekStartDateString
//                     });

//                 }
//             }
//             console.log("successfully updated database")
//           } catch (error) {
//             console.error(`Error fetching and inserting data for location ${locationIndex}, day ${dayIndex}, category ${categoryIndex}:`, error);
//           }
//         }
//       }
//     }
//   }
//   catch{
//     console.log("ded")
//   }
//   return c.text('attempted to update weekly thing to pav')
// })

// app.get('/weekly-update-dc', async (c) => {
//   const db = drizzle(c.env.DB)
//   const result = await db.select().from(menu).all()
//   return c.json(result)
// })
// .post('/weekly-update-dc', async (c) => {
//   const db = drizzle(c.env.DB)
//   try {
//     for (let locationIndex = 1; locationIndex < 2; locationIndex++) {
//       for (let dayIndex = 0; dayIndex < idDay.length; dayIndex++) {
//         const categoryArray = locationIndex === 0 ? idCategoryPav : idCategoryDC;
//         const nameCategoryArray = locationIndex === 0 ? nameCategoryPav : nameCategoryDC;

//         for (let categoryIndex = 0; categoryIndex < categoryArray.length; categoryIndex++) {
//           try {
//             // Fetch the menu data for this location, day, and category (meal)
//             const menuData:any = await fetchMenu(locationIndex, dayIndex, categoryIndex);
//             const orderedPairs = menuData.data.menuItems.map((item: { name: string; description: string; }) => [item.name, item.description] as [string, string]);
//             // ordered pairs look like: Greek Chicken,@Carbone: Protein Choice of Greek Chicken (4oz) or Greek Eggplant Steaks (4oz) with Garlic Butter
//             for (let i = 0; i < orderedPairs.length; i++){
//                 const stationName = (orderedPairs[i][1].includes(":") ? orderedPairs[i][1].match(/^[^:]+/)[0] : "")
//                 const items = orderedPairs[i][1].replace(/^[^:]*:\s*/, "")// this is a really dumb way to parse the menu (case insensitive)
//                 .replace(/\s*\(.*?\)\s*/g, ' ')  // remove content in parentheses
//                 .replace(/:/g, ' ')      //destroy colons
//                 .replace(/;/g, ' ') 
//                 // remove verbose langauge >:C
//                 .replace(/\bProtein\b/gi, ' ')    
//                 .replace(/\bChoice\b/gi, ' ')    
//                 .replace(/\bOf\b/gi, ' ')    
//                 .replace(/\bServed\b/gi, ' ')
//                 .replace(/\bSides\b/gi, ' ')       
//                 .replace(/\bOption\b/gi, ' ')       
//                 .replace(/\bOptions\b/gi, ' ')    
//                 .replace(/\bCome\b/gi, ' ')    
//                 .replace(/\bComes\b/gi, ' ') 
//                 .replace(/\bMeal\b/gi, ' ')  
//                 .replace(/\bMindful\b/gi, ' ')     
//                 //split these into different items   
//                 .replace(/\bOn a\b/gi, ',')  
//                 .replace(/\bthe day\b/gi, ',')  
//                 .replace(/\bOn\b/gi, ',')  
//                 .replace(/\bOr\b/gi, ',')       
//                 .replace(/\bAnd\b/gi, ',')       
//                 .replace(/&/g, ',')  //&
//                 .replace(/\bWith\b/gi, ',')     
//                 .replace(/\bIn\b/gi, ',')      
//                 .replace(/w\//g, ',')    //  w/

//                 // format string for further use  
//                 .replace(/\. /g, ",") // i cant believe they also typo , as . 
//                 .split(',')
//                 .map((item: string) => item.trim()) //remove whitepsace
//                 .map((item: string) => item.trim().replace(/\.$/, '')) //remove trailing periods
//                 .filter((item: string) => item !== ''); //remove empty items
//                 for (let j = 0; j < items.length; j++){
//                     // console.log(nameLocation[locationIndex]+ " : " + nameCategoryArray[categoryIndex] + " : " + nameDay[dayIndex] + " : " + stationName + " : " + items[j])
//                     const newItemID= uuidv4()
//                     await db.insert(menu).values({
//                             location: nameLocation[locationIndex], // Make sure this is a string
//                             day: nameDay[dayIndex], // Make sure this is a string
//                             meal: nameCategoryArray[categoryIndex], // Make sure this is a string
//                             station: stationName,
//                             item_id: newItemID,
//                             name: items[j],
//                             missing_reports: 0,
//                     });

//                 }
//             }
//             console.log("successfully updated database")
//           } catch (error) {
//             console.error(`Error fetching and inserting data for location ${locationIndex}, day ${dayIndex}, category ${categoryIndex}:`, error);
//           }
//         }
//       }
//     }
//   }
//   catch{
//     console.log("ded")
//   }
//   return c.text('attempted to update weekly thing to dc')
// })

// export default app

import { DrizzleD1Database } from 'drizzle-orm/d1';
import { sql } from 'drizzle-orm';
import dayjs from 'dayjs';
import { menu } from '../schemas/drizzle'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and } from 'drizzle-orm';
import { Hono } from 'hono'
import { nameLocation, nameCategoryPav, nameCategoryDC, nameDay, idLocation, idCategoryPav, idCategoryDC, idDay, pavMenuGroupTime, formatTimePAV, fetchMenu, formatTimeDC, dcMenuGroupTime } from "./menu_functions"
import { v4 as uuidv4 } from 'uuid';
import { cors } from 'hono/cors'
import foodTruckRoutes from './routes/foodtrucks';
import { FoodTruckService } from './services/foodTruckService';


interface CloudflareBindings {
  DB: D1Database;
}

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use(cors());
// app.use(
//   '/*',
//   cors({
//     origin: ['http://ucmmm.com', 'http://localhost:3000/'],
//     allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests'],
//     allowMethods: ['POST', 'GET', 'OPTIONS'],
//     exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
//     maxAge: 600,
//     credentials: true,
//   })
// )

app.get('/', (c) => {
  return c.text('Hello Hono changed! ucmmm!')
})

async function populatePavilionDataForWeek(db: DrizzleD1Database<Record<string, never>>, weekStartDateString: string): Promise<{ success: boolean; error?: any }> {
  console.log(`Starting data population for Pavilion, week: ${weekStartDateString}`);
  try {
    const locationIndex = 0;
    const existingData = await db.select({ count: sql<number>`count(*)` })
      .from(menu)
      .where(and(eq(menu.week, weekStartDateString), eq(menu.location, nameLocation[locationIndex])))
      .get();

    if (existingData && existingData.count > 0) {
      console.log(`Data for Pavilion week ${weekStartDateString} already exists. Skipping population.`);
      return { success: true };
    }
    for (let dayIndex = 0; dayIndex < idDay.length; dayIndex++) {
      const categoryArray = idCategoryPav;
      const nameCategoryArray = nameCategoryPav;

      for (let categoryIndex = 0; categoryIndex < categoryArray.length; categoryIndex++) {
        try {
          const menuData: any = await fetchMenu(locationIndex, dayIndex, categoryIndex);
          if (!menuData?.data?.menuItems) {
            console.warn(`No menu items found for loc:${locationIndex}, day:${dayIndex}, cat:${categoryIndex}`);
            continue;
          }
          const orderedPairs = menuData.data.menuItems.map((item: { name: string; description: string; }) => [item.name, item.description] as [string, string]);
          for (let i = 0; i < orderedPairs.length; i++) {
            const stationName = (orderedPairs[i][1].includes(":") ? orderedPairs[i][1].match(/^[^:]+/)?.[0] ?? "" : "");
            const items = orderedPairs[i][1].replace(/^[^:]*:\s*/, "")
              .replace(/\s*\(.*?\)\s*/g, ' ')
              .replace(/:/g, ' ')
              .replace(/;/g, ' ')
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
              .replace(/\bOn a\b/gi, ',')
              .replace(/\bthe day\b/gi, ',')
              .replace(/\bOn\b/gi, ',')
              .replace(/\bOr\b/gi, ',')
              .replace(/\bAnd\b/gi, ',')
              .replace(/&/g, ',')
              .replace(/\bWith\b/gi, ',')
              .replace(/\bIn\b/gi, ',')
              .replace(/w\//g, ',')
              .replace(/\. /g, ",")
              .split(',')
              .map((item: string) => item.trim())
              .map((item: string) => item.trim().replace(/\.$/, ''))
              .filter((item: string) => item !== '');
            for (let j = 0; j < items.length; j++) {
              const newItemID = uuidv4();
              await db.insert(menu).values({
                location: nameLocation[locationIndex],
                day: nameDay[dayIndex],
                meal: nameCategoryArray[categoryIndex],
                station: stationName,
                item_id: newItemID,
                name: items[j],
                missing_reports: 0,
                week: weekStartDateString
              }).execute();
            }
          }
          console.log(`Successfully processed loc:${locationIndex}, day:${dayIndex}, cat:${categoryIndex}`);
        } catch (fetchInsertError) {
          console.error(`Error fetching/inserting for loc ${locationIndex}, day ${dayIndex}, cat ${categoryIndex}:`, fetchInsertError);
          // add stuff to do here when something fails to populate
        }
      }
    }
    console.log(`Data population for Pavilion, week: ${weekStartDateString} completed successfully.`);
    return { success: true };
  }
  catch (error) {
    console.error(`Major error during Pavilion data population for week ${weekStartDateString}:`, error);
    return { success: false, error: error };
  }
}

async function populateDCDataForWeek(db: DrizzleD1Database<Record<string, never>>, weekStartDateString: string): Promise<{ success: boolean; error?: any }> {
  console.log(`Starting data population for Pavilion, week: ${weekStartDateString}`);
  try {
    const locationIndex = 1;
    const existingData = await db.select({ count: sql<number>`count(*)` })
      .from(menu)
      .where(and(eq(menu.week, weekStartDateString), eq(menu.location, nameLocation[locationIndex])))
      .get();

    if (existingData && existingData.count > 0) {
      console.log(`Data for DC week ${weekStartDateString} already exists. Skipping population.`);
      return { success: true };
    }
    for (let dayIndex = 0; dayIndex < idDay.length; dayIndex++) {
      const categoryArray = idCategoryDC;
      const nameCategoryArray = nameCategoryDC;

      for (let categoryIndex = 0; categoryIndex < categoryArray.length; categoryIndex++) {
        try {
          const menuData: any = await fetchMenu(locationIndex, dayIndex, categoryIndex);
          if (!menuData?.data?.menuItems) {
            console.warn(`No menu items found for loc:${locationIndex}, day:${dayIndex}, cat:${categoryIndex}`);
            continue;
          }
          const orderedPairs = menuData.data.menuItems.map((item: { name: string; description: string; }) => [item.name, item.description] as [string, string]);
          for (let i = 0; i < orderedPairs.length; i++) {
            const stationName = (orderedPairs[i][1].includes(":") ? orderedPairs[i][1].match(/^[^:]+/)?.[0] ?? "" : "");
            const items = orderedPairs[i][1].replace(/^[^:]*:\s*/, "")
              .replace(/\s*\(.*?\)\s*/g, ' ')
              .replace(/:/g, ' ')
              .replace(/;/g, ' ')
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
              .replace(/\bOn a\b/gi, ',')
              .replace(/\bthe day\b/gi, ',')
              .replace(/\bOn\b/gi, ',')
              .replace(/\bOr\b/gi, ',')
              .replace(/\bAnd\b/gi, ',')
              .replace(/&/g, ',')
              .replace(/\bWith\b/gi, ',')
              .replace(/\bIn\b/gi, ',')
              .replace(/w\//g, ',')
              .replace(/\. /g, ",")
              .split(',')
              .map((item: string) => item.trim())
              .map((item: string) => item.trim().replace(/\.$/, ''))
              .filter((item: string) => item !== '');
            for (let j = 0; j < items.length; j++) {
              const newItemID = uuidv4();
              await db.insert(menu).values({
                location: nameLocation[locationIndex],
                day: nameDay[dayIndex],
                meal: nameCategoryArray[categoryIndex],
                station: stationName,
                item_id: newItemID,
                name: items[j],
                missing_reports: 0,
                week: weekStartDateString
              }).execute();
            }
          }
          console.log(`Successfully processed loc:${locationIndex}, day:${dayIndex}, cat:${categoryIndex}`);
        } catch (fetchInsertError) {
          console.error(`Error fetching/inserting for loc ${locationIndex}, day ${dayIndex}, cat ${categoryIndex}:`, fetchInsertError);
          // add stuff to do here when something fails to populate
        }
      }
    }
    console.log(`Data population for Pavilion, week: ${weekStartDateString} completed successfully.`);
    return { success: true };
  }
  catch (error) {
    console.error(`Major error during Pavilion data population for week ${weekStartDateString}:`, error);
    return { success: false, error: error };
  }
}


app.get('/menu/:week/:location/:day/:meal', async (c) => {
  const db = drizzle(c.env.DB);
  const week = c.req.param('week');
  const location = c.req.param('location');
  const day = c.req.param('day');
  const meal = c.req.param('meal');

  // Define the query condition
  const queryCondition = and(
    eq(menu.week, week),
    eq(menu.location, location),
    eq(menu.day, day),
    eq(menu.meal, meal)
  );


  let result = await db.select().from(menu).where(queryCondition).all();


  if (result.length === 0 && location === "pav") {
    console.log(`No menu data found for pav/${week}/${day}/${meal}. Attempting to populate...`);

    const populationResult = await populatePavilionDataForWeek(db, week);

    if (populationResult.success) {
      console.log("Population logic finished. Re-querying database...");
      result = await db.select().from(menu).where(queryCondition).all();
      console.log(`Found ${result.length} items after population attempt.`);
    } else {
      console.error("Population logic failed.", populationResult.error);

    }
  }
  else if (result.length === 0 && location === "dc") {
    console.log(`No menu data found for dc/${week}/${day}/${meal}. Attempting to populate...`);

    const populationResult = await populateDCDataForWeek(db, week);

    if (populationResult.success) {
      console.log("Population logic finished. Re-querying database...");
      result = await db.select().from(menu).where(queryCondition).all();
      console.log(`Found ${result.length} items after population attempt.`);
    } else {
      console.error("Population logic failed.", populationResult.error);

    }
  }

  return c.json(result);
});

app.get('/item/:id', async (c) => {
  const db = drizzle(c.env.DB)
  const { id } = c.req.param()
  const result = await db.select().from(menu).where(eq(menu.item_id, id),)
  return c.json(result)
})
app.post('/item/:id/missing', async (c) => {
  const db = drizzle(c.env.DB);
  const { id } = c.req.param();
  const currentItem = await db.select().from(menu).where(eq(menu.item_id, id)).execute();
  if (currentItem.length === 0) {
    return c.json({ error: "Item not found" }, 404);
  }
  const updatedReports = currentItem[0].missing_reports + 1;
  const result = await db.update(menu)
    .set({ missing_reports: updatedReports })
    .where(eq(menu.item_id, id));
  return c.json({ success: true, updatedReports });
});
app.post('/item/:id/missing/reset', async (c) => {
  const db = drizzle(c.env.DB);
  const { id } = c.req.param();
  const currentItem = await db.select().from(menu).where(eq(menu.item_id, id)).execute();
  if (currentItem.length === 0) {
    return c.json({ error: "Item not found" }, 404);
  }
  const updatedReports = 0;
  const result = await db.update(menu)
    .set({ missing_reports: updatedReports })
    .where(eq(menu.item_id, id));
  return c.json({ success: true, updatedReports });
});

app.post('/weekly-update-pav', async (c) => {
  const db = drizzle(c.env.DB);
  const currentDate = dayjs();
  const weekStart = currentDate.startOf('week');
  const weekStartDateString = weekStart.format('YYYY-MM-DD');

  console.log(`POST /weekly-update-pav received. Triggering population for week ${weekStartDateString}`);
  const result = await populatePavilionDataForWeek(db, weekStartDateString);

  if (result.success) {
    return c.text(`Pavilion data update initiated/checked for week ${weekStartDateString}. Status: Success.`);
  } else {
    return c.json({ error: "Failed to update Pavilion data.", details: result.error }, 500);
  }
});


app.post('/weekly-update-dc', async (c) => {
  return c.text('attempted to update weekly thing to dc - will fix later');
});

// Mount food truck routes
app.route('/foodtrucks', foodTruckRoutes);

// Export with scheduled handler for cron triggers
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: CloudflareBindings, ctx: ExecutionContext) {
    console.log(`Cron trigger fired at ${new Date().toISOString()}`);

    const db = drizzle(env.DB);
    const service = new FoodTruckService(db);

    // Pre-fetch current and next week to warm the cache
    const result = await service.refreshCache();

    console.log('Cache refresh completed:', result);
  }
};
